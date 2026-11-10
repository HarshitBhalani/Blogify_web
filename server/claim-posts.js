// Assigns posts that have no owner (created before accounts existed) to one user.
// Usage: npm run claim-posts -- you@example.com
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Blog } = require('./models');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.log('Usage: npm run claim-posts -- you@example.com');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`No account with email ${email}. Sign up in the app first.`);
    process.exit(1);
  }
  const result = await Blog.updateMany(
    { $or: [{ owner: { $exists: false } }, { owner: null }] },
    { $set: { owner: user._id, author: user.name } }
  );
  console.log(`Assigned ${result.modifiedCount} post(s) without an owner to ${user.name} <${email}>.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
