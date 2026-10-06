export type BoostCase = { id: string; input: string; mustKeep: string[] }

export type ReplyCase = { id: string; question: string; reply: string; mustKeep: string[] }

export const boostCases: BoostCase[] = [
  { id: 'gift-wrap-price', input: 'price wrong when i choose gift wrap on staging, fix pls', mustKeep: ['gift wrap', 'staging'] },
  {
    id: 'csv-sku',
    input: 'the orders csv file dont have supplier sku. jira ticket say put it new column after product name. other columns must stay same',
    mustKeep: ['supplier', 'SKU', 'Jira', 'product name'],
  },
  {
    id: 'checkout-mobile',
    input: 'checkout page on shop-theme is bad on phone. the place order button go out of screen on iphone. sometimes shipping part go on top of the totals box. also letters are too big on small phone. maybe problem is flex in checkout css, i am not sure. dont change computer view, it is ok. after fix please test on staging with phone size',
    mustKeep: ['shop-theme', 'iPhone', 'shipping', 'totals', 'flex', 'staging', 'desktop'],
  },
  { id: 's3-bucket', input: 'cdk storagestack need new s3 bucket for invoice pdfs', mustKeep: ['CDK', 'StorageStack', 'S3', 'invoice'] },
  { id: 'youtube', input: 'hey bro i want an app like youtube and to play it in broweser', mustKeep: ['YouTube', 'browser'] },
  { id: 'typo-only', input: 'rename getUserNmae to getUserName in src/user.ts', mustKeep: ['getUserNmae', 'getUserName', 'src/user.ts'] },
  {
    id: 'error-text',
    input: "npm run build fails with TypeError: Cannot read properties of undefined (reading 'map') in OrderList.tsx line 42, fix it",
    mustKeep: ['npm run build', "TypeError: Cannot read properties of undefined (reading 'map')", 'OrderList.tsx', '42'],
  },
  { id: 'question', input: 'whats the diffrence between git rebase and merge which one i use', mustKeep: ['rebase', 'merge'] },
  {
    id: 'multi-ask',
    input: 'add dark mode toggle to settings page, save it in localstorage, and also the header logo is blurry fix that too',
    mustKeep: ['dark mode', 'settings', 'localStorage', 'logo'],
  },
  { id: 'turkish-mix', input: 'login sayfasi cok yavas aciliyor, 5 saniye suruyor, neden bak', mustKeep: ['login', '5'] },
  {
    id: 'reviewer',
    input: 'alex said in PR review the discount calc rounds wrong, it gives 9.99 instead of 10.00, check it',
    mustKeep: ['Alex', 'discount', '9.99', '10.00'],
  },
  { id: 'vague-refactor', input: 'refactor the pricing calc thing its a mess and nobody gets it', mustKeep: ['pricing'] },
]

export const replyCases: ReplyCase[] = [
  {
    id: 'oop',
    question: 'whats oop',
    mustKeep: ['object'],
    reply: `## OOP (Object-Oriented Programming)

OOP is a programming paradigm that organizes code around **objects**: units that bundle data (state) and the functions that operate on it (methods). Instead of keeping data and functions separate, each object owns its state and exposes behaviour.

### Core concepts
- **Class**: a blueprint. **Object**: an instance of the class with its own values.
- **Encapsulation**: internal state is hidden; callers use a controlled interface, so the object stays valid.
- **Abstraction**: callers know *what* an object does, not *how*.
- **Inheritance**: a child class reuses and overrides a parent's methods (is-a).
- **Polymorphism**: the same call (\`shape.area()\`) runs different code depending on the real type.

### SOLID
SOLID is five design principles for OOP code:
- **S**ingle Responsibility: one reason to change per class.
- **O**pen/Closed: extend with new classes, do not edit the parent.
- **L**iskov Substitution: a child must work anywhere the parent works.
- **I**nterface Segregation: many small interfaces beat one big one.
- **D**ependency Inversion: depend on abstractions, not concrete classes.

Prefer composition (has-a) over deep inheritance trees; inheritance couples classes tightly.`,
  },
  {
    id: 'rebase-merge',
    question: 'git rebase vs merge which one should i use',
    mustKeep: ['rebase', 'merge', 'force', 'pushed'],
    reply: `Both integrate changes from one branch into another, but they record history differently.

**git merge**
- Creates a merge commit that joins the two histories.
- Keeps the exact history, including when branches diverged.
- Safe on shared branches: it never rewrites existing commits.

**git rebase**
- Replays your commits on top of the target branch, creating new commit hashes.
- Gives a clean, linear history with no merge commits.
- Rewrites history, so after rebasing a pushed branch you must \`git push --force-with-lease\`.

**Which to use**
- Rebase your own feature branch onto \`main\` before opening a PR: \`git fetch && git rebase origin/main\`.
- Merge the PR into \`main\` (or squash-merge, per your repo's convention).
- Never rebase a branch other people are working on; it breaks their local copies.

**Warning:** \`git push --force\` without \`--with-lease\` can overwrite a teammate's commits. Always use \`--force-with-lease\`.

If a rebase goes wrong, \`git rebase --abort\` returns you to where you started, and \`git reflog\` can recover lost commits.`,
  },
  {
    id: 'docker-volume',
    question: 'my postgres data disappears when i restart docker compose why',
    mustKeep: ['volume', 'docker compose down -v', 'remove'],
    reply: `Your data disappears because the database files live inside the container's writable layer, which is deleted when the container is removed.

Looking at your \`docker-compose.yml\`, the \`db\` service has no volume:

\`\`\`yaml
services:
  db:
    image: postgres:16
\`\`\`

Add a named volume so the data is stored outside the container:

\`\`\`yaml
services:
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
\`\`\`

Then run \`docker compose up -d\`. Data now survives \`docker compose down\` and restarts.

Important: \`docker compose down -v\` deletes named volumes too, so do not use \`-v\` unless you want to wipe the database.

Your existing data is already gone; the volume only protects data from now on. If you have a dump, restore it with \`psql -U postgres < backup.sql\` after the container is up.`,
  },
  {
    id: 'bugfix-report',
    question: 'fix the gift wrap price bug on staging',
    mustKeep: ['pricing.js', 'staging', 'tested'],
    reply: `Fixed. The gift wrap price was added twice when gift wrap was selected after the quantity changed.

**Root cause**
In \`assets/js/pricing.js\`, \`updateTotal()\` is called from both the quantity \`change\` handler and the gift wrap \`click\` handler. The gift wrap handler added \`wrapPrice\` to the running total instead of recomputing from the base price, so each quantity change followed by a gift wrap pick stacked the wrap price again.

**Fix**
- \`updateTotal()\` now always recomputes from \`basePrice + wrapPrice + shippingPrice\`.
- Removed the incremental \`total += wrapPrice\` line.
- Added a unit test \`pricing.test.js\` covering: quantity change then wrap pick, wrap pick then quantity change, and two wrap changes in a row. All 3 pass.

**Verified on staging**
- 2 mugs + red gift wrap: shows $34.00 (was $39.00).
- Changing quantity to 3 then picking blue wrap: $46.50, correct.

**Not tested**
- Safari on iOS; please check on a real iPhone.
- Bulk order pages use a different pricing path (\`bulk-pricing.js\`) that I did not touch.`,
  },
  {
    id: 'cdk-bucket',
    question: 'add an s3 bucket for invoice pdfs to the cdk storagestack',
    mustKeep: ['cdk diff', 'RETAIN', 'invoice', 'deploy'],
    reply: `Added an \`InvoicesBucket\` to \`lib/storage-stack.ts\`.

\`\`\`ts
const invoices = new s3.Bucket(this, 'InvoicesBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  enforceSSL: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
  lifecycleRules: [{ transitions: [{ storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(90) }] }],
});
\`\`\`

Choices I made:
- **Private** with all public access blocked; invoices contain customer data.
- **RETAIN** so a stack delete never destroys invoices.
- Moves objects to Infrequent Access after 90 days to cut cost.
- Exported the bucket name as \`InvoicesBucketName\` so the API stack can read it.

I did **not** deploy. Run \`npx cdk diff StorageStack\` first and check that the only change is one new bucket plus the output.

Open point: the API Lambda still needs \`invoices.grantReadWrite(apiFn)\`, which lives in the API stack. Tell me if you want that wired too.`,
  },
  {
    id: 'useeffect',
    question: 'why does my useEffect run twice',
    mustKeep: ['StrictMode', 'cleanup'],
    reply: `It runs twice because React 18 **StrictMode** mounts every component twice in development on purpose. It mounts, unmounts, then mounts again to catch effects that do not clean up after themselves.

This only happens in development. In a production build each effect runs once on mount.

What to do:
- Do not remove \`<React.StrictMode>\`; the double run is exposing a real problem if something breaks.
- Make the effect safe to run twice by returning a cleanup function:

\`\`\`js
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/orders', { signal: controller.signal }).then(r => r.json()).then(setOrders);
  return () => controller.abort();
}, []);
\`\`\`

- For subscriptions, unsubscribe in the cleanup. For timers, \`clearInterval\` in the cleanup.

If the effect sends something that must happen only once (like a payment or analytics event), it should not be in a \`useEffect\` at all; trigger it from the user action (the click handler) instead.`,
  },
  {
    id: 'sql-index',
    question: 'orders page query is slow how do i fix',
    mustKeep: ['EXPLAIN ANALYZE', 'CONCURRENTLY', 'customer_id', 'transaction'],
    reply: `The slow part is the orders list query filtering by \`customer_id\` and sorting by \`created_at\`. There is no index covering it, so Postgres scans the whole \`orders\` table (about 2.1M rows).

I checked with:

\`\`\`sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 123 ORDER BY created_at DESC LIMIT 50;
\`\`\`

Result: \`Seq Scan on orders\`, 1840 ms.

Fix: add a composite index matching the filter and the sort:

\`\`\`sql
CREATE INDEX CONCURRENTLY idx_orders_customer_created ON orders (customer_id, created_at DESC);
\`\`\`

\`CONCURRENTLY\` builds the index without locking writes, which matters on the live database. It takes longer and cannot run inside a transaction, so run it on its own, not in a migration that wraps statements in a transaction.

After the index, the same query uses \`Index Scan\` and takes about 3 ms.

Also: the page selects \`*\` but only shows 6 columns. Selecting only those columns would cut transfer size, but it is a smaller win than the index.`,
  },
  {
    id: 'npm-eresolve',
    question: 'npm install gives ERESOLVE error',
    mustKeep: ['ERESOLVE', '--legacy-peer-deps', 'react-datepicker', '--force'],
    reply: `The \`ERESOLVE unable to resolve dependency tree\` error means two packages want incompatible versions of a shared peer dependency.

From your log:
- \`react-datepicker@4.8.0\` requires \`react@^16 || ^17\`
- your project uses \`react@18.2.0\`

Options, best first:

1. **Upgrade the package** to a version that supports React 18:
\`\`\`bash
npm install react-datepicker@latest
\`\`\`
Version 6+ supports React 18. Check its changelog; the \`onChange\` signature changed in v5.

2. **Install anyway** while ignoring peer conflicts:
\`\`\`bash
npm install --legacy-peer-deps
\`\`\`
This works but hides a real incompatibility; the datepicker may break at runtime.

3. **Do not** use \`--force\`; it can install a broken tree silently.

I recommend option 1. After upgrading, run the app and test every page that has a date field.`,
  },
  {
    id: 'staging-report',
    question: 'test the checkout fix on staging',
    mustKeep: ['staging', 'iPhone', 'failed'],
    reply: `Tested the checkout fix on staging with Playwright at four viewport sizes.

**Passed**
- 1440x900 desktop: layout unchanged, "Place order" visible, totals correct.
- 768x1024 tablet: shipping and totals stack correctly, no overlap.
- 390x844 (iPhone 14 size): "Place order" button stays on screen, full width.

**Failed**
- 320x568 (iPhone SE size): the coupon field still overflows by about 12px to the right, which adds a horizontal scrollbar. The cause is a fixed \`width: 340px\` on \`.coupon-input\` in \`checkout.css\`.

**Console**
- No new JS errors. One existing warning about a missing favicon, unrelated.

**Network**
- \`/wp-admin/admin-ajax.php?action=update_totals\` returns 200 in about 180 ms after each change.

Next step: change \`.coupon-input\` to \`width: 100%; max-width: 340px;\`. It is a one-line fix; tell me and I will apply it and retest at 320px.`,
  },
  {
    id: 'regex',
    question: 'explain this regex ^(?=.*\\d)(?=.*[a-z]).{8,}$',
    mustKeep: ['8', 'digit', 'lowercase'],
    reply: `This regex checks a password with three rules. It does not capture anything; it only tests whether the whole string matches.

\`^(?=.*\\d)(?=.*[a-z]).{8,}$\`

Piece by piece:
- \`^\` and \`$\`: anchor to the start and end, so the whole string must match, not just part of it.
- \`(?=.*\\d)\`: a **lookahead**. It checks that somewhere ahead there is at least one digit, without moving the position.
- \`(?=.*[a-z])\`: another lookahead: at least one lowercase letter.
- \`.{8,}\`: then any characters, at least 8 of them.

So it matches strings that are at least 8 characters long and contain at least one digit and one lowercase letter.

Examples:
- \`hello123\` matches.
- \`HELLO123\` fails: no lowercase letter.
- \`hello\` fails: too short and no digit.

Note: it allows spaces and does not require uppercase or symbols. If your password policy needs uppercase, add \`(?=.*[A-Z])\`.`,
  },
]
