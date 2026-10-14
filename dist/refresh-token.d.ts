import type { KiroAuthMethod } from "./oauth.js";
/**
 * The refresh field is a pipe-delimited record, not an opaque token, because a
 * credential that has been through pi's store comes back with only `access`,
 * `refresh` and `expires` — the extra `KiroCredentials` fields do not survive.
 * Anything the refresh chain still needs therefore has to be packed in here.
 *
 * ```text
 * idc           refreshToken | clientId | clientSecret  | idc          [| region]
 * external-idp  refreshToken | clientId | tokenEndpoint | external-idp [| region]
 * desktop       refreshToken |                            desktop      [| region]
 * apikey        apiKey       |                            apikey
 * ```
 *
 * The auth-method marker keeps its historical position and the region is
 * appended after it, so strings written by earlier versions still parse: the
 * marker is located by scanning for it rather than by taking the last segment.
 *
 * `apikey` carries no region — a Kiro API key is not issued against an SSO
 * region, and the one it is validated in is a fixed constant, not a discovery.
 */
export interface KiroRefreshParts {
    /** The refresh token, or the API key itself for the `apikey` method. */
    token: string;
    /** Method-specific segments between the token and the auth-method marker. */
    fields: string[];
    authMethod: KiroAuthMethod;
    /** SSO region the credential was issued in, when the writer knew it. */
    region?: string;
}
export declare function parseKiroRefresh(refresh: string): KiroRefreshParts;
export declare function encodeKiroRefresh(parts: KiroRefreshParts): string;
/**
 * The SSO region a credential was issued in, or undefined when it is unknown.
 *
 * Prefers the live `region` field, which is set while the credential is still
 * the object a login or refresh returned, and falls back to the region encoded
 * in the refresh string, which is what survives persistence.
 */
export declare function kiroCredentialRegion(credentials: {
    region?: string;
    refresh?: string;
} | undefined): string | undefined;
