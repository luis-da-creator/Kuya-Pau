# Kuya Pau's Barbershop: Online Reservation System

Node.js + Express + MongoDB backend, plain HTML/CSS/JS frontend (served by the backend, so there is one server and one port).

```
kuya-paus-barbershop/
├── backend/
│   ├── .env                 settings (Mongo URI, JWT secret, payment info, email/SMS keys)
│   ├── server.js            Express server (also serves ../frontend)
│   ├── seed.js              creates the admin, 3 barbers and the services
│   ├── config/              db connection + shop rules (50% down payment, ₱20 late fee, 12-hour cancel)
│   ├── models/              User, Barber, Service, Booking, Attendance, Transaction
│   ├── routes/              auth, public, customer, admin, barber
│   └── utils/ middleware/
└── frontend/
    ├── index.html           1. Terms & Conditions (must agree first)
    ├── login.html           2. Customer login / create account
    ├── customer.html        Reserve · Services · About Us · Description · Contact Us · My Reservations
    ├── admin-login.html  →  admin.html    Dashboard · Reservations · Barbers · Customers · Transactions
    ├── barber-login.html →  barber.html   Time in/out · schedule · upcoming reservations
    └── css/ js/ images/
```

## Run it

You need Node 18+ and MongoDB (local, or a free MongoDB Atlas connection string).

```bash
cd backend
npm install
# edit .env: MONGO_URI, ADMIN_PASSWORD, PAYMENT_NUMBER (your GCash number)
npm run seed      # first time only
npm start
```

Open http://localhost:5000

| Panel | Page | Default login |
|---|---|---|
| Customer | `/` (terms first) | create an account |
| Admin | `/admin-login.html` | `admin` / `ChangeMe123!` |
| Barbers | `/barber-login.html` | `kuyapau`, `kuyapaul`, `kuyageo` / `Barber@123` |

Change these passwords in `.env` **before** running `npm run seed` (or edit them later: barbers from the admin Barbers window).

## How the rules work

- **Terms first.** `index.html` must be agreed to before `login.html` opens. The server also refuses login/register without agreement and saves the date.
- **50% down payment.** Haircut ₱150 → ₱75, braids ₱600 → ₱300. The customer sends it by GCash and enters the reference number. The slot is held as *Pending* right away.
- **Admin approves or rejects.** Approve = payment verified (the down payment is recorded as income and the slot stays booked). Reject = slot is freed.
- **Complete.** Admin ticks "arrived late" (+₱20) and can add an extra charge (e.g. braid extensions). The balance collected after service = price − down payment + late fee + extras.
- **Cancel / no-show.** Customer cancels 12+ hours ahead → refund due (admin clicks *Mark refunded*). Less than 12 hours, or admin marks *No-show* → down payment kept.
- **Schedules.** A slot is taken while a reservation is Pending/Approved and is free again when it is cancelled, rejected, forfeited or done. Customers, admin and barbers all read the same data, and the database blocks double booking.
- **Barber time in/out.** Logging in records Time In. Time Out is a separate button, and signing out does not time out.
- **Verification code.** A 6-digit code is created on booking, sent by email and SMS, and always shown under *My Reservations*. Admin can search reservations by code.
- **Income graphs** count real cash movements: down payments, balances, and refunds as negatives.

## Things to set up yourself

- **Email / SMS codes** need keys in `.env` (`SMTP_*` for email, `SEMAPHORE_API_KEY` for SMS). Without them the code is printed in the server console and still shown in *My Reservations*.
- **Service photos** are simple illustrations. To use real photos, put the files in `frontend/images/`, update the `image` paths in `backend/seed.js`, and run `npm run seed` again (this also updates prices and descriptions).
- **Payment is manual.** The system stores the GCash reference number and the admin checks it against the real payment. It does not connect to a payment gateway.
- **HTTPS.** Put the app behind HTTPS (e.g. a reverse proxy) before going live, and use a strong `JWT_SECRET`.
