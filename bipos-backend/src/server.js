import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Server } from 'socket.io';
import { authRouter } from './routes/auth.js';
import { menuRouter } from './routes/menu.js';
import { tableRouter } from './routes/tables.js';
import { orderRouter } from './routes/orders.js';
import { kitchenRouter } from './routes/kitchen.js';
import { paymentRouter } from './routes/payments.js';
import { userRouter } from './routes/users.js';
import { shiftRouter } from './routes/shifts.js';
import { reportRouter } from './routes/reports.js';
import { cashierRouter } from './routes/cashier.js';
import { settingsRouter } from './routes/settings.js';
import { verifyToken } from './lib/auth.js';
import { branchRoom, restaurantRoom, tableRoom } from './lib/socketEvents.js';
import { verifyTableToken } from './lib/tableToken.js';
import { prisma } from './lib/prisma.js';

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? undefined : '*');
const corsOptions = { origin: allowedOrigin, credentials: true };
const io = new Server(server, { cors: corsOptions });

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
  if (!token) return next();
  try {
    socket.data.user = verifyToken(token);
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

async function joinVerifiedTableRoom(socket, payload, ack) {
  try {
    const tableToken = typeof payload === 'string' ? payload : payload?.tableToken;
    const tokenData = verifyTableToken(tableToken);
    const table = await prisma.table.findFirst({
      where: { id: tokenData.tableId, branchId: tokenData.branchId, qrCode: tokenData.qrCode },
      select: { id: true },
    });
    if (!table) throw new Error('Invalid table token');
    socket.join(tableRoom(table.id));
    if (typeof ack === 'function') ack({ ok: true, tableId: table.id });
  } catch (error) {
    if (typeof ack === 'function') ack({ ok: false, error: 'Invalid table token' });
    socket.emit('table:join:error', { error: 'Invalid table token' });
  }
}

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user?.restaurantId) socket.join(restaurantRoom(user.restaurantId));
  if (user?.branchId) socket.join(branchRoom(user.branchId));
  if (user?.role) socket.join(`role:${user.role}`);
  socket.on('table:join', (payload, ack) => joinVerifiedTableRoom(socket, payload, ack));
  socket.emit('connected', { ok: true });
});

app.disable('x-powered-by');
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use((req, _res, next) => { req.io = io; next(); });
app.get('/health', (_req, res) => res.json({ ok: true, name: 'bipos-backend' }));
app.use('/api/auth', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/tables', tableRouter);
app.use('/api/orders', orderRouter);
app.use('/api/kitchen', kitchenRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/users', userRouter);
app.use('/api/shifts', shiftRouter);
app.use('/api/reports', reportRouter);
app.use('/api/cashier', cashierRouter);
app.use('/api/settings', settingsRouter);
app.use((err, _req, res, _next) => {
  const status = Number(err.status || err.statusCode || 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error' : err.message || 'Server error' });
});
const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`BIPOS backend running on :${port}`));
