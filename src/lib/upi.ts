export function generateUPILink(params: {
  merchantUPI: string
  amount: number
  billId: string
  shopName: string
}): string {
  return `upi://pay?pa=${params.merchantUPI}` +
    `&pn=${encodeURIComponent(params.shopName)}` +
    `&am=${params.amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${params.billId}`
}

export function generateWhatsAppMessage(link: string, amount: number, billId: string): string {
  return `Daiva Automobiles — Payment Request%0ABill: ${billId}%0AAmount: ₹${amount.toFixed(2)}%0APay here: ${link}`
}
