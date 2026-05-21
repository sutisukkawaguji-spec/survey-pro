// คอนฟิกค่าคอนฟิกของ Cloudinary (แนะนำให้เอาไปใส่ใน Script Properties เพื่อความปลอดภัย)
const CLOUD_NAME = "dsi3g3dix";
const API_KEY = "722894334646583";
const API_SECRET = "0V9c_hMD78FEXmPyQkdlFFMV5pY"; // ปลอดภัยแน่นอน เพราะรันบนเซิร์ฟเวอร์ Google

// ฟังก์ชันตอบกลับสำหรับการเรียกแบบ OPTIONS (Preflight)
function doOptions(e) {
  return ContentService.createTextOutput("OK")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ฟังก์ชันตอบกลับสำหรับการเรียกแบบ GET
function doGet(e) {
  let output = { success: false, message: "" };

  try {
    const publicId = e.parameter.publicId;

    if (!publicId) throw new Error("ไม่ได้รับ Public ID");

    // สร้าง Signature สำหรับ Cloudinary
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, stringToSign, Utilities.Charset.UTF_8)
      .reduce((str, byte) => str + ("0" + (byte & 0xFF).toString(16)).slice(-2), "");

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      payload: { public_id: publicId, api_key: API_KEY, timestamp: timestamp, signature: signature },
      muteHttpExceptions: true
    });

    const result = JSON.parse(res.getContentText());
    if (result.result === "ok") {
      output.success = true;
      output.message = "ลบรูปสำเร็จ";
    } else {
      throw new Error(result.error ? result.error.message : "ลบไม่สำเร็จ");
    }
  } catch (err) {
    output.message = err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function doPost(e) {
  let output = { success: false, message: "" };

  try {
    const data = JSON.parse(e.postData.contents);
    const publicId = data.publicId;

    if (!publicId) throw new Error("ไม่ได้รับ Public ID");

    // สร้าง Signature สำหรับ Cloudinary
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, stringToSign, Utilities.Charset.UTF_8)
      .reduce((str, byte) => str + ("0" + (byte & 0xFF).toString(16)).slice(-2), "");

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      payload: { public_id: publicId, api_key: API_KEY, timestamp: timestamp, signature: signature },
      muteHttpExceptions: true
    });

    const result = JSON.parse(res.getContentText());
    if (result.result === "ok") {
      output.success = true;
      output.message = "ลบรูปสำเร็จ";
    } else {
      throw new Error(result.error ? result.error.message : "ลบไม่สำเร็จ");
    }
  } catch (err) {
    output.message = err.toString();
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}