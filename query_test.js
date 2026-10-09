import { db, getDocs, collection, query, limit } from './js/common/firebase-config.js';
const q = query(collection(db, 'tic2_game_results'), limit(5));
const snap = await getDocs(q);
snap.forEach(d => console.log(d.data()));
