import React from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Building,
  Calendar,
  CreditCard,
  User,
  MapPin,
  Check
} from 'lucide-react';

/**
 * Utility to convert amount number to words (Indian numbering system)
 */
function numberToWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val < 20) return a[val];
    const digit = val % 10;
    return b[Math.floor(val / 10)] + (digit ? ' ' + a[digit] : '');
  }

  let words = '';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;

  if (crore > 0) words += inWords(crore) + ' Crore ';
  if (lakh > 0) words += inWords(lakh) + ' Lakh ';
  if (thousand > 0) words += inWords(thousand) + ' Thousand ';
  if (hundred > 0) words += inWords(hundred) + ' Hundred ';
  if (rest > 0) words += (words !== '' ? 'and ' : '') + inWords(rest) + ' ';

  return 'INR ' + words.trim() + ' Rupees Only';
}

export default function PaymentReceiptModal({ transaction, onClose }) {
  const [copiedField, setCopiedField] = React.useState(null);

  if (!transaction) return null;

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const receiptNo = transaction.receiptNo || `REC-SLE-${(transaction.transactionId || transaction.id || '').replace(/^pay_/, '').slice(0, 10).toUpperCase() || '2026-001'}`;
  const amountFormatted = Number(transaction.amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div
      id="printable-receipt-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto printable-modal"
    >
      <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full p-4 sm:p-8 shadow-2xl border border-slate-300 relative max-h-[96vh] overflow-y-auto">

        {/* Action Header Bar (Hidden during window.print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6 print-hide print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Official Payment Receipt & Tax Invoice
              </h3>
              <p className="text-xs text-slate-500">
                Razorpay Live Transaction Confirmed
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Close Receipt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE OFFICIAL RECEIPT CONTENT */}
        <div id="printable-receipt-content" className="bg-white text-slate-900 space-y-6 font-sans p-2 sm:p-4 printable-document">

          {/* Top Organization Header */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900/80">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
              <img src="/logo-1.jpg" alt="SLE Institutions" className="w-full h-full object-contain" />
            </div>

            <div className="text-center flex-1 px-3">
              <h1 className="text-lg sm:text-2xl font-black text-slate-950 tracking-wider uppercase">
                S L E INSTITUTE
              </h1>
            </div>

            <div className="text-right shrink-0">
              <div className="inline-flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Receipt Type</span>
                <span className="text-xs font-black text-slate-900 uppercase">E-Fee Receipt</span>
                <span className="mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  PAID & VERIFIED
                </span>
              </div>
            </div>
          </div>

          {/* Receipt Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receipt Number</span>
              <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">{receiptNo}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Date & Time</span>
              <span className="font-bold text-slate-800 text-xs">{transaction.dateTime || transaction.date || 'N/A'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payment Gateway</span>
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                {transaction.gateway || 'Razorpay Live'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branch / Center</span>
              <span className="font-bold text-rose-700 text-xs truncate block">{transaction.branch || transaction.franchiseName || 'Athani'}</span>
            </div>
          </div>

          {/* Razorpay Gateway Audit Identifiers */}
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-900 uppercase">Razorpay Payment ID:</span>
                <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-indigo-200">
                  {transaction.paymentId || transaction.transactionId || 'N/A'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(transaction.paymentId || transaction.transactionId, 'payId')}
                className="print-hide print:hidden text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                {copiedField === 'payId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'payId' ? 'Copied' : 'Copy Payment ID'}</span>
              </button>
            </div>

            {transaction.orderId && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Razorpay Order ID:</span>
                  <span className="font-mono font-medium text-slate-700">
                    {transaction.orderId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(transaction.orderId, 'orderId')}
                  className="print-hide print:hidden text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                >
                  {copiedField === 'orderId' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === 'orderId' ? 'Copied' : 'Copy Order ID'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Billed To / Candidate Info */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-white">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
              Payer & Registration Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Candidate / Payer Name:</span>
                <span className="font-black text-slate-900 text-sm uppercase">{transaction.payerName || 'N/A'}</span>
              </div>

              {transaction.registrationNo && (
                <div>
                  <span className="text-slate-500 block">Registration / Roll Number:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">{transaction.registrationNo}</span>
                </div>
              )}

              {transaction.course && (
                <div>
                  <span className="text-slate-500 block">Course / Program Enrolled:</span>
                  <span className="font-bold text-slate-900">{transaction.course}</span>
                </div>
              )}

              {transaction.planName && (
                <div>
                  <span className="text-slate-500 block">Franchisee Plan:</span>
                  <span className="font-bold text-slate-900">{transaction.planName}</span>
                </div>
              )}

              {transaction.payerPhone && (
                <div>
                  <span className="text-slate-500 block">Contact Phone:</span>
                  <span className="font-medium text-slate-800">{transaction.payerPhone}</span>
                </div>
              )}

              {transaction.payerEmail && (
                <div>
                  <span className="text-slate-500 block">Registered Email:</span>
                  <span className="font-medium text-slate-800">{transaction.payerEmail}</span>
                </div>
              )}
            </div>
          </div>

          {/* Itemized Fee Breakdown Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Particulars / Fee Description</th>
                  <th className="p-3 text-center">Category</th>
                  <th className="p-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="p-3 font-bold text-slate-400">01</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">
                      {transaction.title || transaction.description || 'Student Admission & Registration Fee'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {transaction.description || `Applicable institutional fee for ${transaction.branch || 'training center'}`}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {transaction.typeLabel || 'Registration Fee'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 text-sm">
                    ₹{amountFormatted}
                  </td>
                </tr>

                {/* Subtotal & Total rows */}
                <tr className="bg-slate-50/50">
                  <td colSpan={3} className="p-2.5 text-right font-bold text-slate-500 text-[11px] uppercase">
                    Subtotal:
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-800 text-xs">
                    ₹{amountFormatted}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <td colSpan={3} className="p-2.5 text-right font-bold text-slate-500 text-[11px] uppercase">
                    GST / Gateway Convenience Fee:
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-800 text-xs">
                    ₹0.00 (Inclusive)
                  </td>
                </tr>
                <tr className="bg-emerald-50 text-slate-900 border-t-2 border-slate-900">
                  <td colSpan={3} className="p-3 text-right font-black uppercase text-xs">
                    Total Amount Paid:
                  </td>
                  <td className="p-3 text-right font-black text-emerald-700 text-base sm:text-lg">
                    ₹{amountFormatted}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount In Words & Verified Seal */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Amount Chargeable in Words:
              </span>
              <span className="font-bold text-slate-800 italic">
                {numberToWords(transaction.amount)}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-200 shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                100% Verified Payment
              </span>
            </div>
          </div>

          {/* Authorized Signatory & Note */}
          <div className="pt-6 border-t border-slate-200 flex items-end justify-between text-xs">
            <div className="space-y-1 max-w-sm text-[10px] text-slate-500 leading-tight">
              <p className="font-bold text-slate-700">Important Terms & Conditions:</p>
              <p>1. This is a computer-generated electronic fee receipt verified through Razorpay Live Gateway.</p>
              <p>2. Fees once paid are non-refundable and non-transferable under society admission rules.</p>
              <p>3. Please retain this receipt along with your Admission Registration Number for future records.</p>
            </div>

            <div className="text-center shrink-0">
              <div className="w-24 h-10 border-b border-dashed border-slate-400 mx-auto mb-1"></div>
              <p className="font-black text-slate-900 text-xs uppercase">Authorized Signatory</p>
              <p className="text-[10px] text-slate-500">SLE Society / Central Office</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
