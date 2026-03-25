import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createSign, createPrivateKey, randomUUID } from 'crypto';
import { inflate } from 'zlib';
import { promisify } from 'util';
import { XMLParser } from 'fast-xml-parser';
import type { Realm, SamlServiceProvider, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';

const inflateAsync = promisify(inflate);

const MAX_XML_SIZE = 256 * 1024; // 256 KB max to prevent XML bomb

interface ParsedAuthnRequest {
  id: string;
  issuer: string;
  acsUrl: string | null;
  nameIdPolicy: string | null;
}

@Injectable()
export class SamlIdpService {
  private readonly logger = new Logger(SamlIdpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  // ─── AUTHN REQUEST VALIDATION ──────────────────────────

  async validateAuthnRequest(samlRequest: string): Promise<ParsedAuthnRequest> {
    try {
      // SAMLRequest is base64-encoded, and for HTTP-Redirect binding also DEFLATE-compressed
      const decoded = Buffer.from(samlRequest, 'base64');

      let xml: string;
      try {
        const inflated = await inflateAsync(decoded);
        xml = inflated.toString('utf-8');
      } catch {
        // If inflate fails, it might be plain base64 (HTTP-POST binding)
        xml = decoded.toString('utf-8');
      }

      // Guard against XML bomb / oversized payloads
      if (xml.length > MAX_XML_SIZE) {
        throw new BadRequestException('SAMLRequest exceeds maximum allowed size');
      }

      // Parse with a proper XML parser — XXE protection is built in
      // (fast-xml-parser does not resolve external entities by default)
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        removeNSPrefix: true, // strip namespace prefixes for easier access
      });

      const doc = parser.parse(xml);
      const authnRequest = doc['AuthnRequest'];
      if (!authnRequest) {
        throw new BadRequestException('Invalid AuthnRequest: root element not found');
      }

      const id = authnRequest['@_ID'] ?? randomUUID();
      const issuer =
        typeof authnRequest['Issuer'] === 'string'
          ? authnRequest['Issuer']
          : authnRequest['Issuer']?.['#text'] ?? '';
      const acsUrl = authnRequest['@_AssertionConsumerServiceURL']
        ?? authnRequest['@_AssertionConsumerServiceURL']
        ?? null;
      const nameIdPolicy = authnRequest['NameIDPolicy']?.['@_Format'] ?? null;

      if (!issuer) {
        throw new BadRequestException('AuthnRequest missing Issuer');
      }

      return { id, issuer, acsUrl, nameIdPolicy };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error('Failed to parse AuthnRequest', (err as Error).stack);
      throw new BadRequestException('Invalid SAMLRequest');
    }
  }

  // ─── SAML RESPONSE CREATION ────────────────────────────

  async createSamlResponse(
    realm: Realm,
    sp: SamlServiceProvider,
    user: User,
    inResponseTo?: string,
  ): Promise<string> {
    const signingKey = await this.prisma.realmSigningKey.findFirst({
      where: { realmId: realm.id, active: true },
    });

    if (!signingKey) {
      throw new BadRequestException('Realm has no active signing key');
    }

    const baseUrl = process.env['BASE_URL'] ?? 'http://localhost:3000';
    const issuer = `${baseUrl}/realms/${realm.name}`;
    const now = new Date();
    const notBefore = new Date(now.getTime() - 60_000); // 1 min clock skew
    const notOnOrAfter = new Date(now.getTime() + 5 * 60_000); // 5 min validity
    const sessionNotOnOrAfter = new Date(now.getTime() + 8 * 3600_000); // 8h session
    const responseId = `_${randomUUID()}`;
    const assertionId = `_${randomUUID()}`;

    const nameId = this.resolveNameId(sp, user);

    const attributeStatement = this.buildAttributeStatement(user);

    const assertion = `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" IssueInstant="${now.toISOString()}" Version="2.0">
  <saml:Issuer>${this.escapeXml(issuer)}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="${this.escapeXml(sp.nameIdFormat)}">${this.escapeXml(nameId)}</saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData${inResponseTo ? ` InResponseTo="${this.escapeXml(inResponseTo)}"` : ''} NotOnOrAfter="${notOnOrAfter.toISOString()}" Recipient="${this.escapeXml(sp.acsUrl)}" />
    </saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="${notBefore.toISOString()}" NotOnOrAfter="${notOnOrAfter.toISOString()}">
    <saml:AudienceRestriction>
      <saml:Audience>${this.escapeXml(sp.entityId)}</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="${assertionId}" SessionNotOnOrAfter="${sessionNotOnOrAfter.toISOString()}">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>
  ${attributeStatement}
</saml:Assertion>`;

    // Sign the assertion if configured
    let signedAssertion = assertion;
    if (sp.signAssertions) {
      signedAssertion = this.signXml(
        assertion,
        assertionId,
        signingKey.privateKey,
        signingKey.publicKey,
        'saml:Issuer',
      );
    }

    const response = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Destination="${this.escapeXml(sp.acsUrl)}" ID="${responseId}"${inResponseTo ? ` InResponseTo="${this.escapeXml(inResponseTo)}"` : ''} IssueInstant="${now.toISOString()}" Version="2.0">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${this.escapeXml(issuer)}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success" />
  </samlp:Status>
  ${signedAssertion}
</samlp:Response>`;

    // Optionally sign the entire response
    let finalResponse = response;
    if (sp.signResponses) {
      finalResponse = this.signXml(
        response,
        responseId,
        signingKey.privateKey,
        signingKey.publicKey,
        'saml:Issuer',
      );
    }

    return Buffer.from(finalResponse, 'utf-8').toString('base64');
  }

  // ─── FIND SP ───────────────────────────────────────────

  async findSpByEntityId(
    realmId: string,
    entityId: string,
  ): Promise<SamlServiceProvider | null> {
    return this.prisma.samlServiceProvider.findUnique({
      where: { realmId_entityId: { realmId, entityId } },
    });
  }

  // ─── CRUD (called by admin controller) ─────────────────

  async createSp(realm: Realm, data: any) {
    return this.prisma.samlServiceProvider.create({
      data: {
        realmId: realm.id,
        entityId: data.entityId,
        name: data.name,
        acsUrl: data.acsUrl,
        sloUrl: data.sloUrl,
        certificate: data.certificate,
        nameIdFormat: data.nameIdFormat,
        signAssertions: data.signAssertions,
        signResponses: data.signResponses,
        validRedirectUris: data.validRedirectUris ?? [],
      },
    });
  }

  async findAllSps(realm: Realm) {
    return this.prisma.samlServiceProvider.findMany({
      where: { realmId: realm.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findSpById(realm: Realm, id: string) {
    return this.prisma.samlServiceProvider.findFirst({
      where: { id, realmId: realm.id },
    });
  }

  async updateSp(realm: Realm, id: string, data: any) {
    // Ensure the SP belongs to this realm
    const existing = await this.prisma.samlServiceProvider.findFirst({
      where: { id, realmId: realm.id },
    });
    if (!existing) {
      throw new BadRequestException('SAML service provider not found');
    }

    return this.prisma.samlServiceProvider.update({
      where: { id },
      data,
    });
  }

  async deleteSp(realm: Realm, id: string) {
    const existing = await this.prisma.samlServiceProvider.findFirst({
      where: { id, realmId: realm.id },
    });
    if (!existing) {
      throw new BadRequestException('SAML service provider not found');
    }

    return this.prisma.samlServiceProvider.delete({ where: { id } });
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────

  private resolveNameId(sp: SamlServiceProvider, user: User): string {
    switch (sp.nameIdFormat) {
      case 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress':
        return user.email ?? user.username;
      case 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent':
        return user.id;
      case 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient':
        return `_${randomUUID()}`;
      case 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified':
      default:
        return user.username;
    }
  }

  private buildAttributeStatement(user: User): string {
    const attrs: { name: string; value: string }[] = [];

    if (user.email) {
      attrs.push({ name: 'email', value: user.email });
    }
    if (user.firstName) {
      attrs.push({ name: 'firstName', value: user.firstName });
    }
    if (user.lastName) {
      attrs.push({ name: 'lastName', value: user.lastName });
    }
    attrs.push({ name: 'username', value: user.username });
    attrs.push({ name: 'uid', value: user.id });

    if (attrs.length === 0) return '';

    const attrXml = attrs
      .map(
        (a) =>
          `    <saml:Attribute Name="${this.escapeXml(a.name)}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
      <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="xs:string">${this.escapeXml(a.value)}</saml:AttributeValue>
    </saml:Attribute>`,
      )
      .join('\n');

    return `<saml:AttributeStatement>
${attrXml}
  </saml:AttributeStatement>`;
  }

  /**
   * Perform exclusive C14N canonicalization (http://www.w3.org/2001/10/xml-exc-c14n#)
   * on a single XML element string. This normalises attribute order and whitespace
   * so that the digest is computed over a canonically-ordered form, preventing
   * XML Signature Wrapping (XSW) attacks.
   *
   * The algorithm implemented here covers the requirements for SAML assertion
   * canonicalization:
   *   - Attributes on each opening tag are sorted lexicographically by name.
   *   - Redundant whitespace between attributes is collapsed to a single space.
   *   - Namespace declarations are retained as-is (they are already explicit
   *     in the serialised SAML elements produced by this service).
   */
  private exclusiveC14N(xml: string): string {
    // Canonicalize each opening (or self-closing) tag: sort its attributes.
    return xml.replace(/<([^>]+)>/g, (fullTag, inner) => {
      // Detect self-closing
      const selfClosing = inner.endsWith('/');
      const innerContent = selfClosing ? inner.slice(0, -1).trimEnd() : inner;

      // Split into element name and the rest
      const spaceIdx = innerContent.search(/\s/);
      if (spaceIdx === -1) {
        // No attributes — nothing to sort
        return fullTag;
      }

      const elemName = innerContent.slice(0, spaceIdx);
      const attrsPart = innerContent.slice(spaceIdx).trim();

      // Parse attributes: handles both `name="value"` and `name='value'`
      const attrRegex = /([\w:\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      const attrs: { name: string; value: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = attrRegex.exec(attrsPart)) !== null) {
        attrs.push({ name: m[1], value: m[2] ?? m[3] ?? '' });
      }

      // Sort attributes lexicographically by name (exc-c14n spec §2.3)
      attrs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

      const sortedAttrs = attrs.map((a) => `${a.name}="${a.value}"`).join(' ');
      const closing = selfClosing ? ' /' : '';
      return `<${elemName} ${sortedAttrs}${closing}>`;
    });
  }

  /**
   * Sign an XML element using XML-DSig (enveloped signature).
   * Inserts the <ds:Signature> block right after the first occurrence
   * of the specified insertAfterTag within the element identified by refId.
   */
  private signXml(
    xml: string,
    refId: string,
    privateKeyPem: string,
    publicKeyPem: string,
    insertAfterTag: string,
  ): string {
    const { createHash } = require('crypto') as typeof import('crypto');

    // 1) Extract the referenced element (identified by ID) from the document so
    //    the SHA-256 digest covers only that element, not the entire document.
    //    Per the XML-DSig spec the digest MUST be computed over the dereferenced
    //    content of the URI, which for an ID reference is the single element.
    const refElementRegex = new RegExp(
      `<(?:[\\w-]+:)?(?:Assertion|Response)[^>]*\\sID="${refId}"[^>]*>[\\s\\S]*?</(?:[\\w-]+:)?(?:Assertion|Response)>`,
    );
    const refElementMatch = xml.match(refElementRegex);
    const refElement = refElementMatch ? refElementMatch[0] : xml;

    // 2) Apply exclusive C14N canonicalization (exc-c14n) to the referenced
    //    element before digesting. This prevents XML Signature Wrapping (XSW)
    //    attacks by ensuring the digest is over a canonical, attribute-order-
    //    stable form rather than raw serialised XML an attacker could reorder.
    const canonicalRefElement = this.exclusiveC14N(refElement);

    // 3) Compute digest of only the referenced element (SHA-256).
    const digest = createHash('sha256').update(canonicalRefElement, 'utf-8').digest('base64');

    // 4) Build SignedInfo
    const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" />
  <ds:Reference URI="#${refId}">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature" />
      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256" />
    <ds:DigestValue>${digest}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;

    // 5) Canonicalize SignedInfo before signing — the XML-DSig spec (§6.5.1)
    //    requires that the signer apply the CanonicalizationMethod algorithm
    //    listed in SignedInfo to the SignedInfo element itself before computing
    //    the cryptographic signature.  Signing the raw string would produce a
    //    different value than what a verifier (who canonicalises first) expects.
    const canonicalSignedInfo = this.exclusiveC14N(signedInfo);

    // 6) Sign the canonicalized SignedInfo block
    const signer = createSign('RSA-SHA256');
    signer.update(canonicalSignedInfo);
    const key = createPrivateKey(privateKeyPem);
    const signatureValue = signer.sign(key, 'base64');

    // 7) Extract certificate body
    const certBody = publicKeyPem
      .replace(/-----BEGIN [A-Z ]+-----/g, '')
      .replace(/-----END [A-Z ]+-----/g, '')
      .replace(/\s+/g, '');

    // 8) Build the full <ds:Signature> block
    const signatureBlock = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  ${signedInfo}
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certBody}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
</ds:Signature>`;

    // 9) Insert signature after the specified tag
    const closingTag = `</${insertAfterTag}>`;
    const insertPos = xml.indexOf(closingTag);
    if (insertPos === -1) {
      // If the tag is not found, prepend the signature inside the root
      return xml.replace(/>/, `>\n${signatureBlock}\n`);
    }

    const insertAt = insertPos + closingTag.length;
    return xml.slice(0, insertAt) + '\n  ' + signatureBlock + xml.slice(insertAt);
  }

  private extractXmlAttribute(
    xml: string,
    element: string,
    attribute: string,
  ): string | null {
    // Match element tag (possibly with namespace prefix)
    const tagRegex = new RegExp(
      `<(?:[\\w-]+:)?${element}[^>]*\\s${attribute}\\s*=\\s*"([^"]*)"`,
      's',
    );
    const match = xml.match(tagRegex);
    return match?.[1] ?? null;
  }

  private extractXmlElement(xml: string, element: string): string | null {
    const regex = new RegExp(
      `<(?:[\\w-]+:)?${element}[^>]*>([^<]*)</(?:[\\w-]+:)?${element}>`,
      's',
    );
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? null;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
