import QRCode from 'qrcode';

export interface UPIPaymentDetails {
    upiId: string;
    name: string;
    amount: number;
    orderId: string;
    note?: string;
}

// Generate UPI deep link
export const generateUPILink = (details: UPIPaymentDetails): string => {
    const { upiId, name, amount, orderId, note } = details;

    const params = new URLSearchParams({
        pa: upiId,                           // Payee VPA
        pn: name,                            // Payee name
        am: amount.toFixed(2),               // Amount
        tn: note || `Order: ${orderId}`,     // Transaction note
        tr: orderId,                         // Transaction reference
        cu: 'INR',                           // Currency
    });

    return `upi://pay?${params.toString()}`;
};

// Generate QR code as data URL
export const generateUPIQRCode = async (
    details: UPIPaymentDetails
): Promise<string> => {
    const upiLink = generateUPILink(details);

    const qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
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

// Generate QR code as buffer (for saving/sending)
export const generateUPIQRBuffer = async (
    details: UPIPaymentDetails
): Promise<Buffer> => {
    const upiLink = generateUPILink(details);
    return QRCode.toBuffer(upiLink, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
    });
};

// Generate order number
export const generateOrderNumber = (): string => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${year}${month}-${random}`;
};
