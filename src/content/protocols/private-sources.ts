/**
 * ===========================================================================
 * THE ENGINEER'S SOURCE DOCUMENTS THAT ARE NOT IN THE PUBLIC REPOSITORY.
 * Operator rulings, 2026-10-22, migration 0080.
 * ===========================================================================
 *
 * The repository is public. These three files carry what the TBPELS register
 * does not publish: both signed copies of 254-RC-001 carry Aman Dhakal's
 * handwritten signature as an embedded image, and the letter templates carry
 * his licence number beside his name. Their originals live in the private
 * bucket eng-protocol-sources on DEVELOPMENT only, and what stays here is how
 * to fetch each one and how to know it is the same file:
 *
 *   path    where the file used to sit, and the name every declaration still
 *           uses for it (RC001_VERSIONS, RC001.sourceFile, ROOF_LETTER_SOURCE).
 *           It is gitignored, so a fetched copy can never be committed.
 *   key     its object key in the bucket.
 *   sha256  its digest, the same digest the declarations pin, so the bytes
 *           fetched are the bytes the transcriptions were proved against.
 *   bytes   its size, a second figure a truncated download cannot match.
 *
 * scripts/lib/protocol-source.mjs `ensurePrivateSources` fetches each into its
 * path before protocol-registry-audit or the roof letter proof reads it, and
 * refuses unless the digest and the size both match. A copy already on disk is
 * checked the same way, never trusted.
 */
export const PROTOCOL_SOURCE_BUCKET = "eng-protocol-sources";

export type PrivateSource = {
  path: string;
  key: string;
  sha256: string;
  bytes: number;
  contentType: string;
  carries: string;
};

export const PRIVATE_SOURCES: readonly PrivateSource[] = [
  {
    path: "docs/254-RC-001-roof-certification-protocol-v1.0.pdf",
    key: "254-RC-001/v1.0/254-RC-001-roof-certification-protocol-v1.0.pdf",
    sha256: "f6d3ca925ddcb305292895c47249199ce86977644d3323d8a0d8ccc017803ba9",
    bytes: 129862,
    contentType: "application/pdf",
    carries: "his handwritten signature, page 11, dated 09/14/2026",
  },
  {
    path: "docs/254-RC-001-roof-certification-protocol-v1.1.pdf",
    key: "254-RC-001/v1.1/254-RC-001-roof-certification-protocol-v1.1.pdf",
    sha256: "d050a21a2b2d43114de47989ca731f41e26951f195c90187e99c11705011e4ef",
    bytes: 130239,
    contentType: "application/pdf",
    carries: "his handwritten signature, page 11, dated 09/20/2026",
  },
  {
    path: "docs/protocols/incoming/v1.1/254_Letter_Templates.docx",
    key: "letter-templates/v1.1/254_Letter_Templates.docx",
    sha256: "7ba7f402e4c89d9ce2c34d50fd385fa6b320b0c4141fe8cc66dd08a2e63d59ea",
    bytes: 49147,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    carries: "his licence number beside his name, six times",
  },
];
