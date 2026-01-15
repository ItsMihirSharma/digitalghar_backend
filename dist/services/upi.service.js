"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOrderNumber = exports.generateUPIQRBuffer = exports.generateUPIQRCode = exports.generateUPILink = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
// Generate UPI deep link
const generateUPILink = (details) => {
    const { upiId, name, amount, orderId, note } = details;
    const params = new URLSearchParams({
        pa: upiId, // Payee VPA
        pn: name, // Payee name
        am: amount.toFixed(2), // Amount
        tn: note || `Order: ${orderId}`, // Transaction note
        tr: orderId, // Transaction reference
        cu: 'INR', // Currency
    });
    return `upi://pay?${params.toString()}`;
};
exports.generateUPILink = generateUPILink;
// Generate QR code as data URL
const generateUPIQRCode = async (details) => {
    const upiLink = (0, exports.generateUPILink)(details);
    const qrCodeDataUrl = await qrcode_1.default.toDataURL(upiLink, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
    });
    return qrCodeDataUrl;
};
exports.generateUPIQRCode = generateUPIQRCode;
// Generate QR code as buffer (for saving/sending)
const generateUPIQRBuffer = async (details) => {
    const upiLink = (0, exports.generateUPILink)(details);
    return qrcode_1.default.toBuffer(upiLink, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
    });
};
exports.generateUPIQRBuffer = generateUPIQRBuffer;
// Generate order number
const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${year}${month}-${random}`;
};
exports.generateOrderNumber = generateOrderNumber;
//# sourceMappingURL=upi.service.js.map