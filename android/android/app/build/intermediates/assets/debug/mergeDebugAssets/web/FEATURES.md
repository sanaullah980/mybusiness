# MyBusiness feature set

MyBusiness now covers the main small-business bookkeeping/POS workflows commonly offered by DigiKhata-style apps, with its own UI and data model.

## Included
- Customer and supplier ledgers
- Gave / Received customer transactions with atomic balance updates
- Customer PDF statements and WhatsApp reminders
- Sales: normal, manual and bulk/quick sale
- Credit sales and customer debt tracking
- Inventory and stock adjustment
- Barcode entry and browser camera barcode scanning where supported
- Stock purchases
- Returns
- Cash Book / cash-in / cash-out and opening balance
- Expense management
- Invoices: PDF, print and WhatsApp sharing
- Business reports and daily/monthly views
- Global search
- Staff Book with staff records and attendance
- Payment reminder list with WhatsApp follow-up
- Business Card creation and sharing
- Local JSON backup and restore
- Firestore offline persistence for cloud-syncing data when connectivity returns
- App PIN lock
- Firebase Email/Password and Google authentication
- Owner-scoped Firestore security rules
- PWA/service-worker caching

## Not included as direct third-party integrations
Some DigiKhata services depend on external commercial/platform infrastructure and cannot be reproduced simply inside a standalone Firebase PWA:
- DigiCash / JazzCash / Easypaisa / bank payment rails
- DigiKhata's free SMS network
- Native biometric authentication on every device
- Hardware POS/card-reader integrations
- DigiKhata referral/reward system

Those can be added later through the relevant provider APIs if you obtain the required merchant/API access.
