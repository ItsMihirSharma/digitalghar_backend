export interface UPIPaymentDetails {
    upiId: string;
    name: string;
    amount: number;
    orderId: string;
    note?: string;
}
export declare const generateUPILink: (details: UPIPaymentDetails) => string;
export declare const generateUPIQRCode: (details: UPIPaymentDetails) => Promise<string>;
export declare const generateUPIQRBuffer: (details: UPIPaymentDetails) => Promise<Buffer>;
export declare const generateOrderNumber: () => string;
//# sourceMappingURL=upi.service.d.ts.map