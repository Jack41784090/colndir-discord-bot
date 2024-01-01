import env from 'dotenv';
import * as firebase_admin from 'firebase-admin';
import * as app from 'firebase-admin/firestore';
env.config();

// Initialize Firebase app with your project configuration
firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert({
        projectId: process.env['FB_PROJECT_ID'],
        privateKey: process.env['FB_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
        clientEmail: process.env['FB_CLIENT_EMAIL'],
    })
});

// Get a reference to the Firebase database service
const database = app.getFirestore()

export async function GetData(collection: string, doc: string) {
    const docRef = database.collection(collection).doc(doc);
    const snapShot = await docRef.get();
    return snapShot.exists ?
        snapShot.data()! :
        null;
}

export async function SaveData<T extends object>(collection: string, doc: string, data: T) {
    const document = database.collection(collection).doc(doc);
    const snapshotData = await document.get();

    console.log(`Saving Data [${collection}] => [${doc}]`, data);
    if (snapshotData.exists) {
        console.log(`||=> Exists`);
        await document.update(data);
    }
    else {
        console.log(`||=> Does not exist. Creating new data.`);
        await document.set(data);
    }

    return data;
}
