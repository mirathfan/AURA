import { DocumentReference, getFirestore } from "firebase-admin/firestore";

// Collection queries omit missing parent documents. Use the SDK's descendant
// traversal so orphaned chat messages and other nested data are deleted too.
export async function deleteDocumentTree(ref: DocumentReference): Promise<number> {
  const db = getFirestore();
  const writer = db.bulkWriter();
  let deleted = 0;
  writer.onWriteResult(() => { deleted += 1; });
  try {
    await db.recursiveDelete(ref, writer);
    return deleted;
  } finally {
    await writer.close();
  }
}
