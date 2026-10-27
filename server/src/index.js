import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/db.js';

const port = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
	throw new Error('JWT_SECRET must be configured in production.');
}
if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
	throw new Error('MONGODB_URI must be configured in production.');
}

await connectDB();
app.listen(port, () => console.log(`Healthcare API listening on http://localhost:${port}`));
