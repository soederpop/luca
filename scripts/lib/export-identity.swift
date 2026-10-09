// Export ONE codesigning identity (by SHA-1 fingerprint) plus the Apple
// intermediate to a PKCS#12 file. `security export` has no per-item filter
// and would touch every private key in the keychain (prompting for each);
// this asks for exactly the one we want. Output is Apple's own p12 flavour,
// which `security import` on a CI runner accepts without openssl help.
//
//   swift export-identity.swift <SHA1-HEX> <out.p12> <password>
import Foundation
import Security
import CommonCrypto

let args = CommandLine.arguments
guard args.count == 4 else { FileHandle.standardError.write("usage: export-identity.swift <sha1> <out.p12> <password>\n".data(using: .utf8)!); exit(64) }
let wantSha = args[1].uppercased()

func sha1(_ data: Data) -> String {
  var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
  data.withUnsafeBytes { _ = CC_SHA1($0.baseAddress, CC_LONG(data.count), &digest) }
  return digest.map { String(format: "%02X", $0) }.joined()
}

var found: CFTypeRef?
let status = SecItemCopyMatching([
  kSecClass as String: kSecClassIdentity,
  kSecMatchLimit as String: kSecMatchLimitAll,
  kSecReturnRef as String: true,
] as CFDictionary, &found)
guard status == errSecSuccess, let identities = found as? [SecIdentity] else {
  FileHandle.standardError.write("no identities readable (status \(status))\n".data(using: .utf8)!); exit(1)
}

var match: SecIdentity?
for identity in identities {
  var cert: SecCertificate?
  guard SecIdentityCopyCertificate(identity, &cert) == errSecSuccess, let c = cert else { continue }
  if sha1(SecCertificateCopyData(c) as Data) == wantSha { match = identity; break }
}
guard let identity = match else {
  FileHandle.standardError.write("identity \(wantSha) not found\n".data(using: .utf8)!); exit(1)
}

var items: [AnyObject] = [identity]
var inter: CFTypeRef?
if SecItemCopyMatching([
  kSecClass as String: kSecClassCertificate,
  kSecMatchSubjectContains as String: "Developer ID Certification Authority",
  kSecMatchLimit as String: kSecMatchLimitAll,
  kSecReturnRef as String: true,
] as CFDictionary, &inter) == errSecSuccess, let certs = inter as? [SecCertificate] {
  items.append(contentsOf: certs as [AnyObject])
}

var params = SecItemImportExportKeyParameters()
params.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
params.passphrase = Unmanaged.passRetained(args[3] as CFString)
var exported: CFData?
let exportStatus = SecItemExport(items as CFArray, .formatPKCS12, [], &params, &exported)
guard exportStatus == errSecSuccess, let data = exported as Data? else {
  FileHandle.standardError.write("SecItemExport failed (status \(exportStatus))\n".data(using: .utf8)!); exit(1)
}
try! data.write(to: URL(fileURLWithPath: args[2]))
