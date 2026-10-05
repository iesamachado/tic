import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

// Read config from file
const content = fs.readFileSync('/media/disco/dades/src/tic2/js/common/firebase-config.js', 'utf8');
const match = content.match(/const firebaseConfig = ({[^}]+});/);
if (match) {
  console.log("Found config");
} else {
  console.log("Config not found");
}
