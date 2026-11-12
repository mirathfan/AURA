// No real credentials, cloud resources or external providers. All fixtures are synthetic.
const assert = require('node:assert/strict');
const req = require('node:module').createRequire(require('node:path').resolve(__dirname, '../functions/package.json'));
for (const [key, value] of Object.entries({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8089', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9198' })) assert.equal(process.env[key], value);
const projectId = 'demo-aura-beta';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, storageBucket: `${projectId}.appspot.com` });
const { initializeApp, deleteApp } = req('firebase-admin/app');
const { getFirestore, Timestamp, DocumentReference } = req('firebase-admin/firestore');
const { getStorage } = req('firebase-admin/storage');
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore(); db.settings({ ignoreUndefinedProperties: true });
const bucket = getStorage().bucket();
const base = '../functions/lib/functions/src/';
const media = require(base + 'shared/mediaSafety');
const { prepareMediaWriteForUser, prepareMediaWrite } = require(base + 'prepareMediaWrite');
const { cleanItemMedia, deleteItemAtomically } = require(base + 'shared/itemLifecycle');
const { setUserDocument, deletionRef } = require(base + 'shared/accountLifecycle');
const { removeDeletedAccountUpload } = require(base + 'deleteAccountData');
const { File } = req('@google-cloud/storage');
const run = `media-${Date.now()}`; const owners = []; let passed = 0;
const realFetch = global.fetch;
global.fetch = (url, ...args) => { assert.match(String(url), /^http:\/\/127\.0\.0\.1:(8089|9198|9098)\//, 'External HTTP blocked'); return realFetch(url, ...args); };
function token(uid) { const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url'); const t = Math.floor(Date.now()/1000); return `${enc({ alg: 'none' })}.${enc({ aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: uid, user_id: uid, iat: t, exp: t+3600, firebase: { sign_in_provider: 'password', identities: {} } })}.`; }
function encode(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k, encode(v)])) } };
}
async function write(uid, target, data, approved = true) {
  if (approved) await prepareMediaWriteForUser(uid, target, [{ mode: 'set', data }]);
  return fetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/${target}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token(uid)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(encode(data).mapValue) });
}
async function expectCode(response, status) { assert.equal(response.status, status, (await response.text()).slice(0,700)); }
function itemData(path) { return { status: 'AVAILABLE', category: 'top', wearCountSinceWash: 0, ...(path ? { photos: { primaryUrl: path } } : {}) }; }
async function owner(label) { const uid = `${run}-${label}`; owners.push(uid); return uid; }
async function image(uid, item = 'shirt', flat = false) { const path = `users/${uid}/items/${item}${flat ? '.jpg' : '/uploads/unique/original.jpg'}`; await bucket.file(path).save(Buffer.from('synthetic'), { metadata: { contentType: 'image/jpeg' } }); return path; }
const exists = async (path) => (await bucket.file(path).exists())[0];
async function expire(uid) { for (const p of (await db.collectionGroup("mediaPermits").get()).docs.filter((p) => p.ref.path.startsWith(`users/${uid}/`))) await p.ref.update({ until: Timestamp.fromMillis(0) }); }
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
function barrier() { let arrive, release; const entered = new Promise((r)=>arrive=r); const gate = new Promise((r)=>release=r); return { entered, release, wait: async()=>{ arrive(); await gate; } }; }
(async () => {
  await check('cleanup activation absent is non-destructive', async()=>{
    await db.doc('releaseControl/mediaSafety').delete(); const uid=await owner('inactive'); const path=await image(uid);
    await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),true); assert.equal((await media.retiredMediaRef(uid,path).get()).exists,false);
  });
  await db.doc('releaseControl/mediaSafety').set({ cleanupEnabled:true });
  await check('two active items share one image; deleting one preserves the other',async()=>{
    const uid=await owner('shared'); const path=await image(uid);
    await expectCode(await write(uid,'items/shirt',itemData(path)),200); await expectCode(await write(uid,'items/copy',itemData(path)),200);
    await deleteItemAtomically(uid,'shirt'); await expire(uid); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),true);
    await deleteItemAtomically(uid,'copy'); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),false);
    assert.equal((await media.retiredMediaRef(uid,path).get()).exists,true);
  });
  await check('saved outfit and orphaned chat snapshots protect legacy media',async()=>{
    const uid=await owner('snapshots'); const path=await image(uid,'shirt',true);
    await expectCode(await write(uid,'savedOutfits/look',{active:true,items:[{imageUrl:path}]}),200);
    await expectCode(await write(uid,'aiChats/missing/messages/message',{type:'assistant',createdAt:1,aura:{look:{pieces:[{imageUrl:path}]}}}),200);
    await expire(uid); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),true);
    await db.doc(`users/${uid}/savedOutfits/look`).delete(); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),true);
    await db.doc(`users/${uid}/aiChats/missing/messages/message`).delete(); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),false);
  });
  await check('soft-deleted outfits release media; restoring a retired snapshot is denied',async()=>{
    const uid=await owner('soft-delete');const path=await image(uid);
    await expectCode(await write(uid,'savedOutfits/look',{active:true,items:[{imageUrl:path}]}),200);
    await expectCode(await write(uid,'savedOutfits/look',{active:false,items:[{imageUrl:path}]}),200);await expire(uid);
    await cleanItemMedia(uid,'shirt');assert.equal(await exists(path),false);
    await assert.rejects(prepareMediaWriteForUser(uid,'savedOutfits/look',[{mode:'update',data:{active:true}}]),(e)=>e.details?.code==='MEDIA_RETIRED');
  });
  await check('legacy ISO wear dates remain editable; counters cannot hide media references',async()=>{
    const uid=await owner('dates');const data={...itemData(),lastWornDate:'2026-10-09',lastWashedDate:'2026-10-09T10:20:30.000Z'};
    await expectCode(await write(uid,'items/date',data),200);
    await expectCode(await write(uid,'items/date',{...data,wearCountSinceWash:2},false),200);
    await expectCode(await write(uid,'items/date',{...data,updatedAt:{imageUrl:`users/${uid}/items/other/p.jpg`}},false),403);
  });
  await check('AI maintenance is server-controlled while consent revocation and manual writes still work',async()=>{
    const uid=await owner('maintenance');const consent=require(base+'shared/aiConsent');const {AI_CONSENT_VERSION}=require('../functions/lib/shared/aiConsent');
    await db.doc(`users/${uid}/privacy/aiConsent`).set({status:'accepted',policyVersion:AI_CONSENT_VERSION,revision:1,updatedAt:Timestamp.now()});
    await db.doc('releaseControl/ai').set({enabled:false});
    try{await assert.rejects(consent.assertAiConsent(uid),(e)=>e.details?.code==='AI_MAINTENANCE');
      await media.mediaLockRef(uid).set({lease:'synthetic',until:Timestamp.now()});
      await consent.updateAiConsent(uid,{status:'revoked',policyVersion:AI_CONSENT_VERSION,expectedRevision:1});
      assert.equal((await db.doc(`users/${uid}/privacy/aiConsent`).get()).get('status'),'revoked');
      await media.mediaLockRef(uid).delete();await expectCode(await write(uid,'items/manual',itemData()),200);
    }finally{await db.doc('releaseControl/ai').delete();}
  });
  await check('six-item extraction batch remains atomic under the actual rules',async()=>{
    const uid=await owner('batch');const path=await image(uid);const writes=[];
    for(let n=0;n<6;n++){const target=`items/batch-${n}`,data=itemData(path);await prepareMediaWriteForUser(uid,target,[{mode:'set',data}]);writes.push({update:{name:`projects/${projectId}/databases/(default)/documents/users/${uid}/${target}`,fields:encode(data).mapValue.fields}});}
    await expectCode(await fetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents:commit`,{method:'POST',headers:{Authorization:`Bearer ${token(uid)}`,'Content-Type':'application/json'},body:JSON.stringify({writes})}),200);
    assert.equal((await db.collection(`users/${uid}/items`).get()).size,6);
  });
  await check('indexed items with stored vectors can still be edited through permits',async()=>{
    const uid=await owner('vectors');const data={...itemData(),embeddingVector:req('firebase-admin/firestore').FieldValue.vector([0.1,0.2])};
    await db.doc(`users/${uid}/items/indexed`).set(data);await prepareMediaWriteForUser(uid,'items/indexed',[{mode:'update',data:{name:'Edited'}}]);
    await expectCode(await fetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/items/indexed?updateMask.fieldPaths=name`,{method:'PATCH',headers:{Authorization:`Bearer ${token(uid)}`,'Content-Type':'application/json'},body:JSON.stringify(encode({name:'Edited'}).mapValue)}),200);
  });
  await check('twelve-item laundry/favorite update remains compatible without media grants',async()=>{
    const uid=await owner('bulk-status');const writes=[];
    for(let n=0;n<12;n++){const target=`items/bulk-${n}`;await db.doc(`users/${uid}/${target}`).set(itemData());writes.push({update:{name:`projects/${projectId}/databases/(default)/documents/users/${uid}/${target}`,fields:encode({status:'IN_LAUNDRY',laundryStatus:'in_laundry',isFavorite:true,updatedAt:1}).mapValue.fields},updateMask:{fieldPaths:['status','laundryStatus','isFavorite','updatedAt']}});}
    await expectCode(await fetch(`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents:commit`,{method:'POST',headers:{Authorization:`Bearer ${token(uid)}`,'Content-Type':'application/json'},body:JSON.stringify({writes})}),200);
    assert.equal((await db.collection(`users/${uid}/items`).where('status','==','IN_LAUNDRY').get()).size,12);
  });
  await check('pending permit protects a reference before the client commit',async()=>{
    const uid=await owner('pending');const path=await image(uid); const data=itemData(path);
    await prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data}]); await cleanItemMedia(uid,'shirt'); assert.equal(await exists(path),true);
    await expectCode(await write(uid,'items/copy',data,false),200);
  });
  await check('concurrent attachment while inventory lease is held fails closed',async()=>{
    const uid=await owner('lease');const path=await image(uid);const gate=barrier(); const original=DocumentReference.prototype.listCollections;
    DocumentReference.prototype.listCollections=async function(...args){ if(this.path===`users/${uid}`)await gate.wait(); return original.apply(this,args); };
    const work=cleanItemMedia(uid,'shirt');
    try { await gate.entered; await assert.rejects(prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data:itemData(path)}]),(e)=>e.details?.code==='MEDIA_BUSY');
      await expectCode(await write(uid,'items/new',itemData(),false),403);
    } finally { gate.release(); DocumentReference.prototype.listCollections=original; }
    await work; assert.equal(await exists(path),false);
  });
  await check('expired lease does not unlock writes; recovery invalidates the stale scanner',async()=>{
    const uid=await owner('expiry');const path=await image(uid);const gate=barrier();const original=DocumentReference.prototype.listCollections;
    DocumentReference.prototype.listCollections=async function(...args){if(this.path===`users/${uid}`)await gate.wait();return original.apply(this,args);};
    const work=cleanItemMedia(uid,'shirt');
    try{await gate.entered;await media.mediaLockRef(uid).update({until:Timestamp.fromMillis(0)});
      await assert.rejects(prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data:itemData(path)}]),(e)=>e.details?.code==='MEDIA_BUSY');
      await media.recoverExpiredMediaLocks(); await expectCode(await write(uid,'items/copy',itemData(path)),200);
    }finally{gate.release();DocumentReference.prototype.listCollections=original;}
    await assert.rejects(work,(e)=>e.details?.code==='MEDIA_BUSY');assert.equal(await exists(path),true);
  });
  await check('same document IDs in separate collections cannot replace each other’s permits',async()=>{
    const uid=await owner('same-id');const path=await image(uid);
    const one=itemData(path),two={active:true,items:[{imageUrl:path}]};
    await prepareMediaWriteForUser(uid,'items/same',[{mode:'set',data:one}]);
    await prepareMediaWriteForUser(uid,'savedOutfits/same',[{mode:'set',data:two}]);
    await expectCode(await write(uid,'items/same',one,false),200);await expectCode(await write(uid,'savedOutfits/same',two,false),200);
  });
  await check('after retirement and before Storage delete, both client and Admin attaches are rejected',async()=>{
    const uid=await owner('retired');const path=await image(uid);const gate=barrier();const original=File.prototype.delete;
    File.prototype.delete=async function(...args){if(this.name===path)await gate.wait();return original.apply(this,args);};
    const work=cleanItemMedia(uid,'shirt');
    try {await gate.entered; await assert.rejects(prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data:itemData(path)}]),(e)=>e.details?.code==='MEDIA_RETIRED');
      await assert.rejects(setUserDocument(db.doc(`users/${uid}/items/copy`),itemData(path)),(e)=>e.details?.code==='MEDIA_RETIRED');
      await expectCode(await write(uid,'items/copy',itemData(path),false),403);
    } finally {gate.release();File.prototype.delete=original;} await work;assert.equal(await exists(path),false);
  });
  await check('expired permits cannot attach; unknown nested fields are protected',async()=>{
    const uid=await owner('expired');const path=await image(uid);const data={...itemData(),futureMedia:{nested:{imageUrl:path}}};
    await prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data}]); await expire(uid); await cleanItemMedia(uid,'shirt');
    await expectCode(await write(uid,'items/copy',data,false),403);assert.equal(await exists(path),false);
  });
  await check('duplicate cleanup workers and stale retries remain idempotent',async()=>{
    const uid=await owner('duplicate');const path=await image(uid);const outcomes=await Promise.allSettled([cleanItemMedia(uid,'shirt'),cleanItemMedia(uid,'shirt')]);
    assert.ok(outcomes.some((r)=>r.status==='fulfilled')); for(const result of outcomes)if(result.status==='rejected')assert.equal(result.reason.details?.code,'MEDIA_BUSY');
    await cleanItemMedia(uid,'shirt');await media.recoverRetiredMedia();assert.equal(await exists(path),false);
  });
  await check('partial Storage failure retains retirement and retries successfully',async()=>{
    const uid=await owner('failure');const path=await image(uid);const original=File.prototype.delete;
    File.prototype.delete=async function(...args){if(this.name===path)throw new Error('injected storage failure');return original.apply(this,args);};
    try{await assert.rejects(cleanItemMedia(uid,'shirt'));}finally{File.prototype.delete=original;}
    assert.equal((await media.retiredMediaRef(uid,path).get()).exists,true);assert.equal(await exists(path),true);
    await media.recoverRetiredMedia();assert.equal(await exists(path),false);
  });
  await check('late upload to retired path is removed by finalizer, without deleting another owner',async()=>{
    const uid=await owner('late');const other=await owner('other');const path=await image(uid);const keep=await image(other);
    await cleanItemMedia(uid,'shirt');await bucket.file(path).save(Buffer.from('late'));const [meta]=await bucket.file(path).getMetadata();
    await removeDeletedAccountUpload.run({data:{name:path,bucket:bucket.name,generation:meta.generation}});assert.equal(await exists(path),false);assert.equal(await exists(keep),true);
  });
  await check('cross-user grants, forged owner and private ledger writes are denied',async()=>{
    const uid=await owner('isolation');const path=await image(await owner('foreign'));
    await assert.rejects(prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data:itemData(path)}]),(e)=>e.code==='permission-denied');
    await assert.rejects(prepareMediaWrite.run({auth:{uid},data:{uid:'other',target:'items/x',patches:[]}}),(e)=>e.code==='permission-denied');
    await expectCode(await write(uid,'mediaPermits/forged',{until:999999999},false),403);
    await expectCode(await write(uid,'retiredMedia/forged',{},false),403);
  });
  await check('Build 9 cannot bypass the new media and deletion contracts; counters stay compatible',async()=>{
    const uid=await owner('build9');const path=await image(uid);
    await expectCode(await write(uid,'items/plain',itemData(),false),403);
    await db.doc(`users/${uid}/items/plain`).set(itemData());
    await expectCode(await write(uid,'items/plain',{...itemData(),wearCountSinceWash:1},false),200);
    await expectCode(await write(uid,'items/plain',{...itemData(),name:'manual edit'},false),403);
    await expectCode(await write(uid,'items/plain',itemData(path),false),403);
    const url=`http://127.0.0.1:8089/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/items/plain`;
    await expectCode(await fetch(url,{method:'DELETE',headers:{Authorization:`Bearer ${token(uid)}`}}),403);
    await expectCode(await fetch(`http://127.0.0.1:9198/v0/b/${bucket.name}/o/${encodeURIComponent(path)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token(uid)}`}}),403);
  });
  await check('account deletion during cleanup prevents new references and owns final cleanup',async()=>{
    const uid=await owner('account');const path=await image(uid);const gate=barrier();const original=File.prototype.delete;
    File.prototype.delete=async function(...args){if(this.name===path)await gate.wait();return original.apply(this,args);};const work=cleanItemMedia(uid,'shirt');
    try {await gate.entered;await deletionRef(uid).set({state:'deleting'});await assert.rejects(prepareMediaWriteForUser(uid,'items/copy',[{mode:'set',data:itemData(path)}]),(e)=>e.details?.code==='ACCOUNT_DELETING');}
    finally{gate.release();File.prototype.delete=original;}await work;assert.equal(await exists(path),false);
  });
  await check('general orphan inventory is bounded, scheduled and recoverable',async()=>{
    const uid=await owner('orphan');const path=`users/${uid}/outfitExtraction/unique/crop.jpg`;await bucket.file(path).save(Buffer.from('orphan'));
    assert.equal(await media.inventoryUserMedia(uid),null);const jobs=await db.collection(`users/${uid}/mediaSweepJobs`).get();assert.equal(jobs.size,1);
    await jobs.docs[0].ref.update({dueAt:Timestamp.fromMillis(0)});await media.recoverMediaSweeps();await media.recoverRetiredMedia();assert.equal(await exists(path),false);
  });
  console.log(`${passed} shared media checks passed; external requests: 0.`);
})().catch((error)=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  global.fetch=realFetch;for(const uid of owners){await db.recursiveDelete(db.doc(`users/${uid}`));await deletionRef(uid).delete();const [files]=await bucket.getFiles({prefix:`users/${uid}/`});await Promise.all(files.map((f)=>f.delete({ignoreNotFound:true})));}
  await deleteApp(app);
});
