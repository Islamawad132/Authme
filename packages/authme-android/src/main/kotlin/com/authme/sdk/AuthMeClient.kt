package com.authme.sdk

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/**
 * Main entry point for the AuthMe Android SDK.
 *
 * Manages the full OAuth 2.0 PKCE login flow, secure token storage via
 * [EncryptedSharedPreferences][androidx.security.crypto.EncryptedSharedPreferences],
 * automatic token refresh, and optional biometric gating.
 *
 * ## Quick start
 * ```kotlin
 * val config = AuthConfig(
 *     serverUrl  = "https://auth.example.com",
 *     realm      = "my-realm",
 *     clientId   = "my-android-app",
 *     redirectUri = "com.example.myapp://callback"
 * )
 * val authMe = AuthMeClient(applicationContext, config)
 *
 * // In your Activity:
 * authMe.login(activity)
 *
 * // In Activity.onNewIntent / onResume handle the redirect:
 * authMe.handleRedirectIntent(intent)
 * ```
 */
class AuthMeClient(
    private val context: Context,
    private val config: AuthConfig,
) {

    // -----------------------------------------------------------------------
    // Internal state
    // -----------------------------------------------------------------------

    private val storage     = TokenStorage(context, config.realm, config.clientId)
    private val json        = Json { ignoreUnknownKeys = true }
    private val scope       = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var oidcConfig  : OIDCConfiguration? = null
    private var refreshJob  : Job? = null

    // -----------------------------------------------------------------------
    // Convenience constructor (flat parameters)
    // -----------------------------------------------------------------------

    constructor(
        context: Context,
        serverUrl: String,
        realm: String,
        clientId: String,
        redirectUri: String,
        scopes: List<String> = listOf("openid", "profile", "email"),
    ) : this(
        context,
        AuthConfig(
            serverUrl   = serverUrl,
            realm       = realm,
            clientId    = clientId,
            redirectUri = redirectUri,
            scopes      = scopes,
        )
    )

    // -----------------------------------------------------------------------
    // Authentication state
    // -----------------------------------------------------------------------

    /** `true` if a valid (non-expired) access token is in storage. */
    val isAuthenticated: Boolean
        get() = storage.accessToken?.let { !isTokenExpired(it) } ?: false

    // -----------------------------------------------------------------------
    // Login
    // -----------------------------------------------------------------------

    /**
     * Start the OAuth 2.0 PKCE login flow using Chrome Custom Tabs.
     *
     * This opens the AuthMe authorization endpoint in a Chrome Custom Tab.
     * When the user completes authentication the browser redirects to your
     * [AuthConfig.redirectUri]. Call [handleRedirectIntent] in your Activity's
     * `onNewIntent` / `onResume` to complete the flow.
     *
     * @param activity The hosting [FragmentActivity].
     */
    suspend fun login(activity: FragmentActivity) {
        val oidc = fetchDiscovery()

        val verifier  = PKCEHelper.generateCodeVerifier()
        val challenge = PKCEHelper.generateCodeChallenge(verifier)
        val state     = PKCEHelper.generateState()

        storage.pkceVerifier = verifier
        storage.authState    = state

        val authUri = Uri.parse(oidc.authorizationEndpoint).buildUpon()
            .appendQueryParameter("response_type",         "code")
            .appendQueryParameter("client_id",             config.clientId)
            .appendQueryParameter("redirect_uri",          config.redirectUri)
            .appendQueryParameter("scope",                 config.scopes.joinToString(" "))
            .appendQueryParameter("state",                 state)
            .appendQueryParameter("code_challenge",        challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .build()

        val customTabsIntent = CustomTabsIntent.Builder()
            .setShowTitle(true)
            .build()

        customTabsIntent.launchUrl(activity, authUri)
    }

    // -----------------------------------------------------------------------
    // Callback / redirect handling
    // -----------------------------------------------------------------------

    /**
     * Handle the redirect Intent sent to your Activity after authorization.
     *
     * Call this from `Activity.onNewIntent` and from `Activity.onResume`
     * (for the case where the Activity was recreated).
     *
     * ```kotlin
     * override fun onNewIntent(intent: Intent?) {
     *     super.onNewIntent(intent)
     *     lifecycleScope.launch {
     *         authMe.handleRedirectIntent(intent)
     *     }
     * }
     * ```
     *
     * @param intent The intent received by the Activity.
     * @return `true` if the intent was an AuthMe callback and was handled successfully.
     */
    suspend fun handleRedirectIntent(intent: Intent?): Boolean {
        val uri = intent?.data ?: return false
        if (!uri.toString().startsWith(config.redirectUri)) return false

        val oidc = fetchDiscovery()

        val error = uri.getQueryParameter("error")
        if (error != null) {
            val description = uri.getQueryParameter("error_description") ?: error
            throw AuthMeException.CallbackError(description)
        }

        val code = uri.getQueryParameter("code")
            ?: throw AuthMeException.CallbackError("Missing authorization code")

        val returnedState = uri.getQueryParameter("state")
        val storedState   = storage.authState
        if (storedState == null || returnedState != storedState) {
            throw AuthMeException.StateMismatch()
        }

        val verifier = storage.pkceVerifier
            ?: throw AuthMeException.PkceVerifierMissing()

        val tokens = exchangeCode(code, verifier, oidc.tokenEndpoint)
        storage.store(tokens)
        storage.pkceVerifier = null
        storage.authState    = null

        scheduleAutoRefresh()
        return true
    }

    // -----------------------------------------------------------------------
    // Logout
    // -----------------------------------------------------------------------

    /**
     * Clear local tokens and attempt server-side session termination.
     *
     * Optionally launches a Custom Tab to the end-session endpoint if the
     * server requires user interaction for logout.
     *
     * @param activity Pass a [FragmentActivity] to open the end-session URL
     *                 in a Custom Tab, or `null` for a silent back-channel logout.
     */
    suspend fun logout(activity: FragmentActivity? = null) {
        val refreshToken = storage.refreshToken
        val oidc         = runCatching { fetchDiscovery() }.getOrNull()

        if (refreshToken != null && oidc?.endSessionEndpoint != null) {
            runCatching {
                httpPost(
                    url  = oidc.endSessionEndpoint,
                    body = "refresh_token=${Uri.encode(refreshToken)}&client_id=${Uri.encode(config.clientId)}",
                    contentType = "application/x-www-form-urlencoded",
                )
            }
        }

        cancelAutoRefresh()
        storage.clear()
    }

    // -----------------------------------------------------------------------
    // Token access
    // -----------------------------------------------------------------------

    /**
     * Returns the current access token, or `null` if not authenticated or expired.
     */
    fun getAccessToken(): String? {
        val token = storage.accessToken ?: return null
        return if (isTokenExpired(token)) null else token
    }

    /**
     * Returns the current access token gated behind a biometric prompt.
     *
     * @param activity The hosting [FragmentActivity].
     * @param title    Title shown in the biometric dialog.
     * @throws [AuthMeException.BiometricAuthFailed] if authentication fails.
     */
    suspend fun getAccessToken(
        activity: FragmentActivity,
        title: String = "Authenticate to access your account",
    ): String? {
        BiometricAuth(activity).authenticate(title = title)
        return getAccessToken()
    }

    // -----------------------------------------------------------------------
    // Token refresh
    // -----------------------------------------------------------------------

    /**
     * Refresh the access token using the stored refresh token.
     *
     * @throws [AuthMeException.NoRefreshToken] if no refresh token is available.
     * @throws [AuthMeException.ServerError] if the server rejects the refresh.
     */
    suspend fun refreshToken() {
        val oidc          = fetchDiscovery()
        val refreshToken  = storage.refreshToken ?: throw AuthMeException.NoRefreshToken()

        val body = listOf(
            "grant_type"    to "refresh_token",
            "refresh_token" to refreshToken,
            "client_id"     to config.clientId,
        ).formEncode()

        val responseBody = httpPost(
            url         = oidc.tokenEndpoint,
            body        = body,
            contentType = "application/x-www-form-urlencoded",
        )

        val tokens = json.decodeFromString<TokenResponse>(responseBody)
        storage.store(tokens)
        scheduleAutoRefresh()
    }

    // -----------------------------------------------------------------------
    // User Info
    // -----------------------------------------------------------------------

    /**
     * Fetch the current user's profile from the userinfo endpoint.
     *
     * @throws [AuthMeException.NotAuthenticated] if no valid token is available.
     */
    suspend fun getUserInfo(): User {
        val accessToken = getAccessToken() ?: throw AuthMeException.NotAuthenticated()
        val oidc        = fetchDiscovery()

        val responseBody = httpGet(
            url     = oidc.userinfoEndpoint,
            headers = mapOf("Authorization" to "Bearer $accessToken"),
        )

        return json.decodeFromString(responseBody)
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /**
     * Cancel background coroutines (auto-refresh). Call from `Activity.onDestroy`
     * or when the client is no longer needed.
     */
    fun destroy() {
        scope.cancel()
    }

    // -----------------------------------------------------------------------
    // Discovery
    // -----------------------------------------------------------------------

    private suspend fun fetchDiscovery(): OIDCConfiguration {
        oidcConfig?.let { return it }

        val body   = httpGet(config.discoveryUrl)
        val result = json.decodeFromString<OIDCConfiguration>(body)
        oidcConfig = result
        return result
    }

    // -----------------------------------------------------------------------
    // Code exchange
    // -----------------------------------------------------------------------

    private suspend fun exchangeCode(
        code: String,
        verifier: String,
        tokenEndpoint: String,
    ): TokenResponse {
        val body = listOf(
            "grant_type"    to "authorization_code",
            "code"          to code,
            "redirect_uri"  to config.redirectUri,
            "client_id"     to config.clientId,
            "code_verifier" to verifier,
        ).formEncode()

        val responseBody = httpPost(
            url         = tokenEndpoint,
            body        = body,
            contentType = "application/x-www-form-urlencoded",
        )

        return json.decodeFromString(responseBody)
    }

    // -----------------------------------------------------------------------
    // Auto-refresh
    // -----------------------------------------------------------------------

    private fun scheduleAutoRefresh() {
        if (!config.autoRefresh) return
        cancelAutoRefresh()

        val token  = storage.accessToken ?: return
        val expiry = jwtExpiry(token) ?: return
        val now    = System.currentTimeMillis() / 1_000L
        val delay  = maxOf(0, expiry - now - config.refreshBuffer) * 1_000L

        refreshJob = scope.launch {
            delay(delay)
            runCatching { refreshToken() }
        }
    }

    private fun cancelAutoRefresh() {
        refreshJob?.cancel()
        refreshJob = null
    }

    // -----------------------------------------------------------------------
    // JWT helpers
    // -----------------------------------------------------------------------

    private fun isTokenExpired(token: String): Boolean {
        val exp = jwtExpiry(token) ?: return true
        return System.currentTimeMillis() / 1_000L >= exp
    }

    private fun jwtExpiry(token: String): Long? {
        val parts = token.split(".")
        if (parts.size != 3) return null

        return runCatching {
            val decoded = Base64.getUrlDecoder().decode(parts[1])
            val payload = String(decoded, Charsets.UTF_8)
            val json    = org.json.JSONObject(payload)
            json.getLong("exp")
        }.getOrNull()
    }

    // -----------------------------------------------------------------------
    // HTTP helpers
    // -----------------------------------------------------------------------

    private suspend fun httpGet(
        url: String,
        headers: Map<String, String> = emptyMap(),
    ): String = kotlinx.coroutines.withContext(Dispatchers.IO) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
            connectTimeout = 15_000
            readTimeout    = 15_000
        }

        try {
            connection.connect()
            val code = connection.responseCode
            val body = connection.inputStream.bufferedReader().readText()

            if (code !in 200..299) {
                throw AuthMeException.ServerError("HTTP $code: $body")
            }
            body
        } finally {
            connection.disconnect()
        }
    }

    private suspend fun httpPost(
        url: String,
        body: String,
        contentType: String,
        headers: Map<String, String> = emptyMap(),
    ): String = kotlinx.coroutines.withContext(Dispatchers.IO) {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput      = true
            setRequestProperty("Content-Type", contentType)
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
            connectTimeout = 15_000
            readTimeout    = 15_000
        }

        try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

            val code     = connection.responseCode
            val stream   = if (code in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.readText() ?: ""

            if (code !in 200..299) {
                val message = runCatching {
                    val jo = org.json.JSONObject(response)
                    jo.optString("error_description").ifBlank { jo.optString("error") }
                }.getOrNull() ?: "HTTP $code"
                throw AuthMeException.ServerError(message)
            }
            response
        } finally {
            connection.disconnect()
        }
    }

    // -----------------------------------------------------------------------
    // Form encoding helper
    // -----------------------------------------------------------------------

    private fun List<Pair<String, String>>.formEncode(): String =
        joinToString("&") { (k, v) ->
            "${Uri.encode(k)}=${Uri.encode(v)}"
        }
}
