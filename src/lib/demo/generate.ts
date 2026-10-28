// Generates the fictional demo data set for a US high school (CLAUDE.md §11).
//
// Self-contained on purpose (no imports): the seed script runs this file with
// plain Node, and the admin "Reset demo data" button uses it from the server.
// A seeded random generator makes the data identical on every reset, while all
// dates are relative to "now" so overdue items and renewals always look current.
// Every person, contract number and price here is made up.

export type DemoUsers = { admin: string; manager: string; staff: string; viewer: string }

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type Row = { [key: string]: JsonValue }

export type DemoPayload = {
  settings: { name: string; asset_tag_prefix: string; default_loan_days: number; fiscal_year_start_month: number }
  categories: Row[]
  locations: Row[]
  assets: Row[]
  licenses: Row[]
  checkouts: Row[]
}

/** Mulberry32: tiny, fast, seeded PRNG so the demo is reproducible. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic UUID v4-shaped ids, so links stay the same across resets. */
function uuidFrom(rand: () => number) {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16))
  hex[12] = "4"
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const h = hex.join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString()
const dateOnly = (d: Date) => d.toISOString().slice(0, 10)

const FIRST = ["Avery", "Jordan", "Riley", "Mateo", "Sofia", "Ethan", "Maya", "Liam", "Zoe", "Noah", "Aaliyah", "Diego", "Harper", "Kai", "Nora", "Elijah", "Priya", "Lucas", "Isla", "Omar", "Chloe", "Mason", "Leah", "Andre", "Grace", "Hugo", "Amara", "Felix", "Jade", "Theo"]
const LAST = ["Alvarez", "Brennan", "Castillo", "Dawson", "Ellison", "Fairbanks", "Greer", "Hollis", "Ibarra", "Jensen", "Kowalski", "Lindqvist", "Marlow", "Nakamura", "Okafor", "Prescott", "Quintero", "Rourke", "Salazar", "Tran", "Underwood", "Vasquez", "Whitfield", "Yamada", "Zeller"]
const TEACHERS = ["Ms. Lee", "Mr. Okafor", "Mrs. Patel", "Mr. Brennan", "Ms. Alvarez", "Dr. Nakamura", "Mr. Hollis", "Ms. Greer", "Coach Dawson", "Mrs. Lindqvist"]

export function generateDemoData(users: DemoUsers, now = new Date()): DemoPayload {
  const rand = rng(20261025)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const id = () => uuidFrom(rand)
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)
  const daysAhead = (n: number) => new Date(now.getTime() + n * DAY)

  // --- Categories (physical + digital, with a few custom fields) ---------
  const cat: Record<string, string> = {}
  const categories: Row[] = []
  const addCat = (key: string, name: string, kind: "physical" | "digital", life: number | null, parent?: string, fields: JsonValue[] = []) => {
    cat[key] = id()
    categories.push({ id: cat[key], name, kind, useful_life_years: life, parent_id: parent ? cat[parent] : null, custom_field_schema: fields })
  }
  addCat("tech", "Technology", "physical", 5)
  addCat("chromebook", "Chromebooks", "physical", 4, "tech", [
    { key: "mac_address", label: "MAC address", type: "text", required: false, options: [] },
    { key: "cart", label: "Cart", type: "text", required: false, options: [] },
  ])
  addCat("laptop", "Staff laptops", "physical", 4, "tech")
  addCat("projector", "Projectors", "physical", 6, "tech", [{ key: "lamp_hours", label: "Lamp hours", type: "number", required: false, options: [] }])
  addCat("doccam", "Document cameras", "physical", 5, "tech")
  addCat("display", "Interactive displays", "physical", 7, "tech")
  addCat("calculator", "Calculators", "physical", 6)
  addCat("textbook", "Textbooks", "physical", 6, undefined, [
    { key: "isbn", label: "ISBN", type: "text", required: true, options: [] },
    { key: "edition", label: "Edition", type: "text", required: false, options: [] },
    { key: "subject", label: "Subject", type: "select", required: false, options: ["Math", "Science", "English", "Social Studies", "World Languages"] },
  ])
  addCat("furniture", "Furniture", "physical", 10)
  addCat("lab", "Lab equipment", "physical", 8)
  addCat("robotics", "Robotics kits", "physical", 4)
  addCat("software", "Software & platforms", "digital", null)
  addCat("ebooks", "E-book collections", "digital", null)
  addCat("subs", "Learning subscriptions", "digital", null)

  // --- Locations ("inventory areas" in the research paper) ---------------
  const loc: Record<string, string> = {}
  const locations: Row[] = []
  const addLoc = (key: string, name: string, type: string, building: string, room: string | null, manager: string | null = null) => {
    loc[key] = id()
    locations.push({ id: loc[key], name, type, building, room, manager_id: manager })
  }
  addLoc("library", "Library", "library", "Main building", "L100", users.manager)
  addLoc("media", "Media Center", "library", "Main building", "L120", users.manager)
  addLoc("it", "IT Office", "office", "Main building", "A105", users.admin)
  addLoc("office", "Main Office", "office", "Main building", "A100")
  addLoc("storage", "Storage Room B", "storage", "Main building", "B012", users.manager)
  addLoc("r101", "Room 101 · English", "classroom", "Main building", "101")
  addLoc("r118", "Room 118 · Art", "classroom", "Arts wing", "118")
  addLoc("r120", "Computer Lab 120", "lab", "Main building", "120")
  addLoc("r204", "Room 204 · Math", "classroom", "Math wing", "204")
  addLoc("r207", "Room 207 · Math", "classroom", "Math wing", "207")
  addLoc("r214", "Science Lab 214", "lab", "Science wing", "214")
  addLoc("r216", "Science Lab 216", "lab", "Science wing", "216")
  addLoc("r310", "Room 310 · Social Studies", "classroom", "Main building", "310")
  addLoc("gym", "Gymnasium", "other", "Athletics", null)
  const classrooms = ["r101", "r118", "r204", "r207", "r214", "r216", "r310"]

  // --- Assets ------------------------------------------------------------
  const assets: Row[] = []
  const licenses: Row[] = []
  const tagCounters = new Map<number, number>()
  const nextTag = (year: number) => {
    const n = (tagCounters.get(year) ?? 0) + 1
    tagCounters.set(year, n)
    return `EDU-${year}-${String(n).padStart(6, "0")}`
  }
  const serials = new Set<string>()
  const serial = (prefix: string, len = 8) => {
    let s = ""
    do {
      s = prefix + Array.from({ length: len }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"[int(0, 33)]).join("")
    } while (serials.has(s))
    serials.add(s)
    return s
  }
  const funding = ["General fund", "Title I", "ESSER", "E-Rate", "PTA", "Title IV-A", "Grant"]

  type AssetSpec = {
    name: string
    category: string
    location: string | null
    manufacturer?: string
    model?: string
    cost: number
    acquired: Date
    serialPrefix?: string
    condition?: string
    status?: string
    vendor?: string
    funding?: string
    custom?: { [key: string]: JsonValue }
    description?: string
  }
  const addAsset = (s: AssetSpec) => {
    const assetId = id()
    const year = s.acquired.getFullYear()
    assets.push({
      id: assetId,
      asset_tag: nextTag(year),
      name: s.name,
      description: s.description ?? null,
      kind: "physical",
      category_id: cat[s.category],
      location_id: s.location ? loc[s.location] : null,
      status: s.status ?? "available",
      condition: s.condition ?? pick(["new", "good", "good", "good", "fair"]),
      serial_number: s.serialPrefix ? serial(s.serialPrefix) : null,
      manufacturer: s.manufacturer ?? null,
      model: s.model ?? null,
      acquisition_date: dateOnly(s.acquired),
      acquisition_cost: s.cost,
      funding_source: s.funding ?? pick(funding),
      vendor: s.vendor ?? null,
      custom_fields: s.custom ?? {},
      notes: null,
      created_by: rand() < 0.7 ? users.manager : users.admin,
      created_at: iso(new Date(s.acquired.getTime() + int(1, 10) * DAY)),
    })
    return assetId
  }

  // Chromebooks: three models, organized into carts by room (120 devices).
  const chromebookIds: string[] = []
  const cbModels = [
    { name: "Acer Chromebook 314", manufacturer: "Acer", model: "C934-C8R0", cost: 289, year: 2023, prefix: "NXK6" },
    { name: "Lenovo 300e Chromebook Gen 4", manufacturer: "Lenovo", model: "82W2", cost: 329, year: 2024, prefix: "PF4X" },
    { name: "HP Chromebook 14 G7", manufacturer: "HP", model: "14 G7", cost: 309, year: 2025, prefix: "5CD3" },
  ]
  const carts = ["r101", "r204", "r207", "r310", "library", "r120"]
  for (let i = 0; i < 120; i++) {
    const m = cbModels[i % 3]
    const room = carts[Math.floor(i / 20)]
    const acquired = new Date(m.year, 7, int(1, 20))
    chromebookIds.push(
      addAsset({
        name: m.name,
        category: "chromebook",
        location: room,
        manufacturer: m.manufacturer,
        model: m.model,
        cost: m.cost,
        acquired,
        serialPrefix: m.prefix,
        vendor: "CDW-G",
        funding: m.year === 2023 ? "ESSER" : m.year === 2024 ? "Title I" : "General fund",
        custom: {
          mac_address: Array.from({ length: 6 }, () => int(0, 255).toString(16).padStart(2, "0")).join(":").toUpperCase(),
          cart: `Cart ${room.replace("r", "")}`,
        },
      })
    )
  }

  // Textbooks: several titles, many copies each, ISBN as a custom field.
  const textbookIds: string[] = []
  const titles = [
    { name: "Algebra 1 (Big Ideas Math)", isbn: "9781642088052", subject: "Math", cost: 112.95, year: 2022, room: "r204" },
    { name: "Biology (Miller & Levine)", isbn: "9781418291457", subject: "Science", cost: 138.5, year: 2021, room: "r214" },
    { name: "The American Pageant, 17th ed.", isbn: "9781337565257", subject: "Social Studies", cost: 129.0, year: 2023, room: "r310" },
    { name: "Chemistry: Matter and Change", isbn: "9780076774609", subject: "Science", cost: 124.75, year: 2020, room: "r216" },
    { name: "Collections, Grade 10", isbn: "9780544569928", subject: "English", cost: 98.4, year: 2019, room: "r101" },
    { name: "¡Así se dice! Level 1", isbn: "9780076604449", subject: "World Languages", cost: 104.3, year: 2024, room: "library" },
  ]
  for (const t of titles) {
    const copies = int(8, 11)
    for (let c = 0; c < copies; c++) {
      textbookIds.push(
        addAsset({
          name: t.name,
          category: "textbook",
          location: t.room,
          cost: t.cost,
          acquired: new Date(t.year, 6, int(5, 25)),
          vendor: "Follett School Solutions",
          condition: pick(["good", "good", "fair", "fair", "poor", "new"]),
          custom: { isbn: t.isbn, edition: "Student edition", subject: t.subject },
          description: `Copy ${c + 1} of ${copies}`,
        })
      )
    }
  }

  // Calculators, projectors, document cameras, displays, laptops.
  const calculatorIds: string[] = []
  for (let i = 0; i < 30; i++) {
    calculatorIds.push(
      addAsset({ name: "TI-84 Plus CE", category: "calculator", location: i < 15 ? "r204" : "r207", manufacturer: "Texas Instruments", model: "84PLCE", cost: 129.99, acquired: new Date(2021 + (i % 3), 7, int(1, 28)), serialPrefix: "TI" })
    )
  }
  for (let i = 0; i < 12; i++) {
    addAsset({ name: "Epson PowerLite Projector", category: "projector", location: pick(classrooms), manufacturer: "Epson", model: "PowerLite 1781W", cost: 649, acquired: new Date(2019 + (i % 5), 5, int(1, 28)), serialPrefix: "X4L", custom: { lamp_hours: int(400, 4800) }, status: i === 3 ? "in_repair" : i === 11 ? "retired" : "available", condition: i === 3 ? "broken" : undefined })
  }
  const docCamIds: string[] = []
  for (let i = 0; i < 10; i++) {
    docCamIds.push(addAsset({ name: "IPEVO V4K Document Camera", category: "doccam", location: i < 4 ? "media" : pick(classrooms), manufacturer: "IPEVO", model: "V4K", cost: 99, acquired: new Date(2022, 8, int(1, 28)), serialPrefix: "IPV" }))
  }
  for (let i = 0; i < 4; i++) {
    addAsset({ name: "Promethean ActivPanel 75\"", category: "display", location: ["r204", "r214", "r101", "media"][i], manufacturer: "Promethean", model: "ActivPanel 9", cost: 3895, acquired: new Date(2024, 6, 15), serialPrefix: "PRM", funding: "ESSER" })
  }
  const laptopIds: string[] = []
  for (let i = 0; i < 10; i++) {
    laptopIds.push(addAsset({ name: "Dell Latitude 3440 (staff)", category: "laptop", location: "it", manufacturer: "Dell", model: "Latitude 3440", cost: 849, acquired: new Date(2024 + (i % 2), 6, int(1, 28)), serialPrefix: "DL", vendor: "Dell Technologies" }))
  }

  // Lab equipment and robotics kits.
  for (let i = 0; i < 8; i++) addAsset({ name: "AmScope Compound Microscope", category: "lab", location: i < 4 ? "r214" : "r216", manufacturer: "AmScope", model: "M150C", cost: 179, acquired: new Date(2020, 7, int(1, 28)), serialPrefix: "AMS" })
  for (let i = 0; i < 4; i++) addAsset({ name: "Ohaus Electronic Balance", category: "lab", location: "r216", manufacturer: "Ohaus", model: "Scout STX", cost: 345, acquired: new Date(2021, 1, int(1, 28)), serialPrefix: "OH" })
  const roboticsIds: string[] = []
  for (let i = 0; i < 6; i++) roboticsIds.push(addAsset({ name: "VEX IQ Education Kit", category: "robotics", location: "r120", manufacturer: "VEX Robotics", model: "IQ 2nd Gen", cost: 499, acquired: new Date(2023, 9, int(1, 28)), serialPrefix: "VEX", funding: "Grant" }))
  for (let i = 0; i < 6; i++) roboticsIds.push(addAsset({ name: "LEGO Education SPIKE Prime Set", category: "robotics", location: "r120", manufacturer: "LEGO Education", model: "45678", cost: 429.95, acquired: new Date(2022, 9, int(1, 28)), serialPrefix: "LGO", funding: "PTA" }))

  // Furniture: student desks and chairs (no serial numbers).
  for (let i = 0; i < 18; i++) addAsset({ name: "Student desk, adjustable", category: "furniture", location: pick(classrooms), manufacturer: "Virco", model: "785", cost: 112, acquired: new Date(2018 + (i % 4), 6, int(1, 28)), funding: "General fund", condition: pick(["good", "fair", "fair", "poor"]) })
  for (let i = 0; i < 12; i++) addAsset({ name: "Stacking chair, 18\"", category: "furniture", location: pick(classrooms), manufacturer: "Virco", model: "9018", cost: 46, acquired: new Date(2019 + (i % 3), 6, int(1, 28)), funding: "General fund" })

  // A couple of items with special statuses for realism.
  const lostCalc = calculatorIds[29]
  for (const a of assets) {
    if (a.id === lostCalc) a.status = "lost"
    if (a.id === chromebookIds[119]) {
      a.status = "retired"
      a.condition = "broken"
    }
  }

  // --- Digital licenses ---------------------------------------------------
  type LicenseSpec = {
    name: string
    category: string
    vendor: string
    type: "per_seat" | "site" | "subscription"
    seats: number | null
    cycle: "monthly" | "annual" | "multi_year" | "one_time"
    cost: number
    renewInDays: number
    url: string
    assigned: number
    acquired: Date
  }
  const licenseSpecs: LicenseSpec[] = [
    { name: "Google Workspace for Education Plus", category: "software", vendor: "Google", type: "per_seat", seats: 120, cycle: "annual", cost: 5760, renewInDays: 248, url: "https://admin.google.com", assigned: 96, acquired: new Date(2022, 6, 1) },
    { name: "Canva for Education", category: "software", vendor: "Canva", type: "site", seats: null, cycle: "annual", cost: 0, renewInDays: 300, url: "https://www.canva.com/education/", assigned: 22, acquired: new Date(2023, 7, 15) },
    { name: "Adobe Express for Education", category: "software", vendor: "Adobe", type: "per_seat", seats: 40, cycle: "annual", cost: 1200, renewInDays: 24, url: "https://adminconsole.adobe.com", assigned: 31, acquired: new Date(2024, 0, 10) },
    { name: "Sora Digital Library (e-books)", category: "ebooks", vendor: "OverDrive Education", type: "subscription", seats: null, cycle: "annual", cost: 3400, renewInDays: 52, url: "https://marketplace.overdrive.com", assigned: 0, acquired: new Date(2021, 8, 1) },
    { name: "Typing.com Pro", category: "subs", vendor: "Teaching.com", type: "per_seat", seats: 30, cycle: "annual", cost: 450, renewInDays: 140, url: "https://www.typing.com/teacher", assigned: 12, acquired: new Date(2024, 7, 20) },
    { name: "IXL Math", category: "subs", vendor: "IXL Learning", type: "per_seat", seats: 25, cycle: "annual", cost: 2875, renewInDays: 180, url: "https://www.ixl.com/admin", assigned: 25, acquired: new Date(2023, 7, 1) },
    { name: "Newsela ELA", category: "subs", vendor: "Newsela", type: "subscription", seats: null, cycle: "annual", cost: 2200, renewInDays: 75, url: "https://newsela.com", assigned: 0, acquired: new Date(2023, 8, 5) },
    { name: "GoGuardian Admin", category: "software", vendor: "GoGuardian", type: "site", seats: null, cycle: "multi_year", cost: 14400, renewInDays: 410, url: "https://admin.goguardian.com", assigned: 0, acquired: new Date(2024, 5, 30) },
    { name: "Turnitin Feedback Studio", category: "software", vendor: "Turnitin", type: "per_seat", seats: 20, cycle: "annual", cost: 3100, renewInDays: 11, url: "https://www.turnitin.com", assigned: 9, acquired: new Date(2022, 7, 12) },
    { name: "Kami Pro", category: "software", vendor: "Kami", type: "per_seat", seats: 15, cycle: "monthly", cost: 125, renewInDays: 19, url: "https://web.kamihq.com", assigned: 6, acquired: new Date(2025, 8, 1) },
  ]
  const seatHolders: { assetId: string; count: number }[] = []
  for (const l of licenseSpecs) {
    const assetId = id()
    assets.push({
      id: assetId,
      asset_tag: nextTag(l.acquired.getFullYear()),
      name: l.name,
      description: null,
      kind: "digital",
      category_id: cat[l.category],
      location_id: null,
      status: "available",
      condition: null,
      serial_number: null,
      manufacturer: l.vendor,
      model: null,
      acquisition_date: dateOnly(l.acquired),
      acquisition_cost: l.cycle === "multi_year" ? l.cost : 0,
      funding_source: pick(["General fund", "Title IV-A", "E-Rate"]),
      vendor: l.vendor,
      custom_fields: {},
      notes: null,
      created_by: users.admin,
      created_at: iso(l.acquired),
    })
    licenses.push({
      asset_id: assetId,
      seats_total: l.seats,
      license_type: l.type,
      billing_cycle: l.cycle,
      cost_per_period: l.cost,
      renewal_date: dateOnly(daysAhead(l.renewInDays)),
      expires_at: dateOnly(daysAhead(l.renewInDays + 30)),
      platform_url: l.url,
      admin_contact: `${l.vendor} education support`,
      contract_number: `EDU-${l.vendor.slice(0, 3).toUpperCase()}-${int(10000, 99999)}`,
      license_key_hint: l.type === "per_seat" ? String(int(1000, 9999)) : null,
    })
    if (l.assigned > 0) seatHolders.push({ assetId, count: l.assigned })
  }

  // --- Checkouts ------------------------------------------------------------
  const checkouts: Row[] = []
  const studentId = () => String(int(10000, 19999))
  const studentName = () => `${pick(FIRST)} ${pick(LAST)}`
  const staffIds = [users.staff, users.manager, users.staff, users.admin]

  /** One loan. `ageDays` = how long ago it went out; `open` = still out. */
  const lend = (assetId: string, ageDays: number, opts: { open?: boolean; overdue?: boolean; loanDays?: number; borrower?: "student" | "staff" | "classroom"; damaged?: boolean }) => {
    const out = daysAgo(ageDays)
    const loanDays = opts.loanDays ?? 14
    const due = opts.overdue ? daysAgo(int(2, 20)) : new Date(out.getTime() + loanDays * DAY)
    const type = opts.borrower ?? "student"
    const by = pick(staffIds)
    const returned = opts.open ? null : new Date(out.getTime() + int(1, loanDays + 3) * DAY)
    checkouts.push({
      id: id(),
      asset_id: assetId,
      borrower_type: type,
      borrower_name: type === "student" ? studentName() : type === "classroom" ? `${pick(["Room 204", "Room 310", "Room 101", "Science Lab 214"])} cart` : pick(TEACHERS),
      borrower_ref: type === "student" ? studentId() : type === "staff" ? `${pick(LAST).toLowerCase()}@lincoln-hs.example` : null,
      checked_out_by: by,
      checked_out_at: iso(out),
      due_at: iso(due),
      returned_at: returned && returned < now ? iso(returned) : null,
      returned_to: returned && returned < now ? pick(staffIds) : null,
      condition_out: "good",
      condition_in: returned && returned < now ? (opts.damaged ? pick(["broken", "poor"]) : pick(["good", "good", "good", "fair"])) : null,
      notes: opts.damaged ? pick(["Cracked screen", "Missing keys", "Water damage reported", "Hinge loose"]) : null,
    })
  }

  // Past loans spread over this school year and last spring (returned).
  const pool = [...chromebookIds.slice(0, 110), ...calculatorIds.slice(0, 28), ...textbookIds, ...docCamIds, ...roboticsIds]
  for (let i = 0; i < 95; i++) lend(pick(pool), int(25, 330), { loanDays: pick([7, 14, 14, 21]) })
  // A few that came back damaged (these items are now in repair).
  const damagedIds = chromebookIds.slice(100, 104)
  for (const a of damagedIds) lend(a, int(20, 60), { damaged: true })

  // Currently out: distinct items, some overdue.
  const used = new Set<string>()
  const openPool = [...chromebookIds.slice(0, 96), ...calculatorIds.slice(0, 25), ...textbookIds.slice(0, 40), ...laptopIds, ...docCamIds.slice(4)]
  const takeFree = () => {
    let a = pick(openPool)
    let guard = 0
    while (used.has(a) && guard++ < 200) a = pick(openPool)
    used.add(a)
    return a
  }
  for (let i = 0; i < 38; i++) lend(takeFree(), int(1, 12), { open: true })
  for (let i = 0; i < 9; i++) lend(takeFree(), int(16, 40), { open: true, overdue: true })
  for (let i = 0; i < 6; i++) lend(takeFree(), int(1, 30), { open: true, borrower: "staff", loanDays: 60 })
  lend(lostCalc, 45, { open: true, overdue: true })

  // Digital seats assigned to teachers and students.
  for (const holder of seatHolders) {
    for (let i = 0; i < holder.count; i++) {
      const toStudent = rand() < 0.5
      checkouts.push({
        id: id(),
        asset_id: holder.assetId,
        borrower_type: toStudent ? "student" : "staff",
        borrower_name: toStudent ? studentName() : pick(TEACHERS),
        borrower_ref: toStudent ? studentId() : `${pick(LAST).toLowerCase()}${i}@lincoln-hs.example`,
        checked_out_by: users.admin,
        checked_out_at: iso(daysAgo(int(10, 70))),
        due_at: null,
        returned_at: null,
        returned_to: null,
        condition_out: null,
        condition_in: null,
        notes: null,
      })
    }
  }

  // Items returned broken stay in repair.
  for (const a of assets) {
    if (damagedIds.includes(a.id as string)) {
      a.status = "in_repair"
      a.condition = "broken"
    }
  }

  return {
    settings: { name: "Lincoln High School", asset_tag_prefix: "EDU", default_loan_days: 14, fiscal_year_start_month: 7 },
    categories,
    locations,
    assets,
    licenses,
    checkouts,
  }
}
