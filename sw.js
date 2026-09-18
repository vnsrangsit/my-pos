// Service Worker สำหรับรับไฟล์ที่แชร์เข้ามาจากแอปอื่น (Shopee) ผ่าน Web Share Target — ใช้ได้เฉพาะ Android/Chrome เท่านั้น
// (iPhone/Safari ไม่รองรับ Web Share Target เลย เป็นข้อจำกัดของแพลตฟอร์ม แก้ไม่ได้)
//
// หลักการ: เว็บนี้โฮสต์บน GitHub Pages ซึ่งเป็น static hosting ล้วนๆ ไม่มีเซิร์ฟเวอร์ประมวลผล POST request ได้
// แต่ manifest.json ประกาศ share_target แบบ method: "POST" ไว้ (จำเป็นเพราะต้องรับ "ไฟล์" ไม่ใช่แค่ข้อความ/ลิงก์)
// ตัว Service Worker นี้เลยต้อง "ดัก" คำขอ POST ที่ระบบส่งมาจากการแชร์ไว้เอง ก่อนที่มันจะไปถึงเน็ตเวิร์ก (ซึ่งจะ error เพราะ GitHub Pages ไม่รับ POST)
// ดึงไฟล์ PDF ออกมาจาก FormData เก็บไว้ใน Cache Storage ชั่วคราว แล้วสั่ง redirect (303) ไปหน้า stocktake.html?share=1 แบบ GET ปกติ
// หน้า stocktake.html เองจะมีโค้ดคอยเช็ค ?share=1 ตอนโหลดหน้า แล้วไปดึงไฟล์จาก Cache Storage มาประมวลผลต่อ (ดูฟังก์ชัน rcCheckIncomingShare ในไฟล์นั้น)

const RC_SHARE_CACHE = 'rc-share-cache-v1';
const RC_SHARE_KEY = 'shared-pdf-payload';

self.addEventListener('install', event => {
  // ให้ Service Worker ใหม่เริ่มทำงานทันทีโดยไม่ต้องรอปิดแท็บเก่าทั้งหมดก่อน (เพิ่งติดตั้งแอปครั้งแรก อยากให้ใช้แชร์ได้เลยไม่ต้องรีสตาร์ท)
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // ดักเฉพาะคำขอ POST ที่ตรงกับ action ที่ประกาศไว้ใน manifest.json (share_target.action) เท่านั้น ปล่อยคำขออื่นๆ ทั้งหมดผ่านไปตามปกติ
  if(event.request.method === 'POST' && url.pathname.endsWith('/stocktake.html')){
    event.respondWith((async () => {
      try{
        const formData = await event.request.formData();
        const file = formData.get('sharedPdf');
        if(file){
          const cache = await caches.open(RC_SHARE_CACHE);
          // เก็บไฟล์ที่แชร์มาไว้ใน Cache Storage ชั่วคราว (อยู่ในเครื่องเท่านั้น ไม่ได้ส่งออกไปไหน) รอหน้า stocktake.html มาดึงไปใช้
          await cache.put(RC_SHARE_KEY, new Response(file, { headers: { 'Content-Type': file.type || 'application/pdf' } }));
        }
      }catch(err){
        // แชร์มาแล้วอ่านไฟล์ไม่สำเร็จ (เช่น ไม่ใช่ PDF) ก็ยังพาไปหน้าเว็บตามปกติ ให้ผู้ใช้กรอกเองได้ ไม่ค้างหน้าจอ error
      }
      // 303 See Other: บอกเบราว์เซอร์ให้ทำ GET request ใหม่ไปหน้านี้แทน (คำขอเดิมเป็น POST ซึ่งรีเฟรชซ้ำไม่ได้/ไม่ควรทำซ้ำ)
      return Response.redirect('./stocktake.html?share=1', 303);
    })());
  }
});
