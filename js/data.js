// ============================================================
// POUR DECISIONS — game data
// ============================================================

const EQUIPMENT = [
  { id:'compactor', name:'Plate Compactor', cost:1200, icon:'🦶',
    desc:'Compacts the class-5 base before the pour. No compaction = settling and cracks. Big subgrade quality boost.' },
  { id:'laser', name:'Rotary Laser Level', cost:900, icon:'📡',
    desc:'Shoot exact grades when setting forms. Shows precise target elevations in the form-setting phase.' },
  { id:'eJack', name:'Electric Jackhammer', cost:1800, icon:'⚡',
    desc:'Breaks out old concrete twice as fast as the rental breaker. Your back will thank you.' },
  { id:'powerScreed', name:'Power Screed', cost:2400, icon:'📏',
    desc:'Vibratory screed strikes off 3 sections of mud per pass during the pour. Huge time saver.' },
  { id:'saw', name:'Early-Entry Concrete Saw', cost:2200, icon:'🪚',
    desc:'Saw-cut control joints a few hours after the pour — cleaner lines, no time pressure, quality bonus over hand-tooled joints.' },
  { id:'trowel', name:'Power Trowel (36")', cost:3500, icon:'🚁',
    desc:'Required for hard-trowel interior finishes (garage floors, shop slabs). Unlocks garage jobs done right.' },
  { id:'buggy', name:'Concrete Buggy', cost:6000, icon:'🛺',
    desc:'Wheel mud to the back of the job fast. +25% time on the truck clock during pours.' },
  { id:'dumpTrailer', name:'14k Dump Trailer', cost:8000, icon:'🚛',
    desc:'Haul demo rubble yourself. Cuts haul-off costs in half.' },
  { id:'skid', name:'Skid Steer', cost:28000, icon:'🚜',
    desc:'The big leagues. Demo goes way faster, haul-off is cheap, and large commercial jobs become possible.' },
  { id:'breaker', name:'Hydraulic Breaker Attachment', cost:9500, icon:'🔨', requires:'skid',
    desc:'Skid steer breaker attachment. Smashes whole sections of slab at once during demo.' },
];

const JOB_TYPES = {
  sidewalk: { label:'Sidewalk', rate:9.0,  icon:'🚶' },
  patio:    { label:'Patio',    rate:9.0,  icon:'🪴' },
  driveway: { label:'Driveway', rate:8.0,  icon:'🚗' },
  garage:   { label:'Garage Floor', rate:8.5, icon:'🏠', interior:true },
  pad:      { label:'Shed Pad', rate:8.5,  icon:'🛖' },
  plaza:    { label:'Commercial Flatwork', rate:11.0, icon:'🏛️' },
};

const MIX_PRICES = {
  perYardBase: 158,      // 5-bag base price per yard
  perBagStep: 12,        // each bag over 5
  air: 6, fiber: 9, lowChert: 7, ncaPerPct: 8,
  delivery: 150, shortLoadFee: 85, secondTruckFee: 275,
};

const FIRST_NAMES = ['Mrs. Henderson','Gary','Roy','Linda','The Walshes','Pastor Jim','Deb & Tom','Coach Olson','Old Man Pekarek','The Hubers','Sandy','Marcus','The VFW','Gwen','Dr. Patel','Big Lou','The Andersons','Tina','Chuck','The Nguyens'];
const STREETS = ['Maple St','3rd Ave','County Rd 12','Birchwood Ln','Lakeshore Dr','Industrial Pkwy','Elm Ct','Old Mill Rd','Sunset Blvd','Tamarack Trl'];

const CUSTOMER_NOTES = [
  'Wants it done before the in-laws visit.',
  'Got three other bids. Doesn’t say from who.',
  'Saw your work down the street. Liked the broom lines.',
  'Asked twice if you’re insured. You are.',
  'Budget-conscious. Mentioned Big Mike’s flyer twice.',
  'Wants it "done right, not done cheap."',
  'Their old slab cracked right down the middle. No joints anywhere.',
  'Dog will absolutely walk through the wet concrete. Plan for it.',
  'Asked if you can match the neighbor’s exposed look. You talked them into broom finish.',
];

// ---- Story ----------------------------------------------------------------

const CHAPTERS = [
  {
    id:1, title:'Chapter 1 — First Pour', repReq:0,
    intro:[
      ['📖','Spring. The plant laid you off in February, and severance doesn’t last forever. What does last is your grandpa’s old finishing kit — mag floats worn to a shine, an edger older than you, and a groover with his initials filed in the handle.'],
      ['📖','You bought a used 3/4-ton, printed business cards at the library, and told your wife this is going to work. Today the phone rang for the first time.'],
      ['🧓','Uncle Dale (40 years of flatwork, retired, bored): "Mrs. Henderson on Maple needs her sidewalk redone. I told her my nephew does good work. Don’t make a liar out of me, kid. I’ll walk you through this one."'],
    ],
    storyJob: { type:'sidewalk', name:'Mrs. Henderson’s Sidewalk', customer:'Mrs. Henderson', len:40, wid:4, thick:4, demo:true,
      desc:'40 ft of heaved, spalled city walk along Maple St. Tear out, re-grade, pour new with a nice broom finish. She’ll be watching from the porch with lemonade.' },
    tutorial:true,
  },
  {
    id:2, title:'Chapter 2 — Word Gets Around', repReq:10,
    intro:[
      ['📖','Mrs. Henderson tells everyone at church. The phone starts ringing. But there’s another truck in town now — a rusted flatbed with a vinyl banner: BIG MIKE’S DISCOUNT CONCRETE — WHY PAY MORE?'],
      ['😤','Big Mike (at the gas station, loudly): "Heard some new kid is charging boutique prices for mud. I pour twice the yards at half the price. Five bag, no air, no joints — concrete’s concrete, baby."'],
      ['🧓','Dale: "Let him race to the bottom. You bid fair, spec the mix right, and cut your joints. Winter sorts out the rest. Now — Gary on 3rd Avenue wants his driveway done, and he wants it done RIGHT."'],
    ],
    storyJob: { type:'driveway', name:'Gary’s Driveway', customer:'Gary', len:48, wid:18, thick:5, demo:true,
      desc:'Old cracked driveway, 48×18. Full tear-out and repour, 5 inches thick. Gary parks a dually and a boat on it. He got a bid from Big Mike and wants to know why yours is higher. Show him.' },
  },
  {
    id:3, title:'Chapter 3 — The Cold Snap', repReq:25,
    intro:[
      ['📖','October. The maples go orange and the forecast goes ugly. Everyone wants their pour in before freeze-up, and the batch plant dispatcher knows your voice now.'],
      ['☎️','Dispatch (Rhonda): "You want what on it, hon? Speak the language: bags, air, fiber, accelerator. The drum don’t care about your feelings and neither do I."'],
      ['🧓','Dale: "Cold pours are where pros separate from pretenders. Below 50°F you order non-chloride accelerator — 1%, maybe 2% if it’s really biting — or you’ll be babysitting bleed water by headlights at 9 PM. And NEVER skip air entrainment outside. Freeze-thaw eats non-air concrete like a county fair corn dog."'],
    ],
    storyJob: { type:'driveway', name:'The Walsh Driveway (Cold Pour)', customer:'The Walshes', len:40, wid:20, thick:5, demo:false, cold:true,
      desc:'New construction, 40×20 driveway, 5 inches. Forecast says 38°F and dropping. The builder needs it poured THIS WEEK or the Walshes can’t close on the house. Spec the mix like you mean it.' },
  },
  {
    id:4, title:'Chapter 4 — Inside Work', repReq:40,
    intro:[
      ['📖','Word around town: three of Big Mike’s driveways scaled off after one winter, and the slab he poured for the hardware store cracked in a lightning-bolt pattern straight through the middle. No air. No joints. Concrete’s concrete, baby.'],
      ['😤','Big Mike (leaving a voicemail, weirdly friendly): "Hey champ. Mike here. Listen — got more work than I can handle. You want my overflow? Standard finder’s fee. Call me." You do not call him.'],
      ['🧓','Dale: "Garage floors now, huh? Different animal. Interior slab gets a hard trowel finish — that means LOW air, 3% or less. Put 6% air under a power trowel and the surface delaminates — blisters and peels like a bad sunburn. Outside: air. Inside: no air. Tattoo it on your arm."'],
    ],
    storyJob: { type:'garage', name:'Coach Olson’s Garage Floor', customer:'Coach Olson', len:26, wid:24, thick:4, demo:true, needs:['trowel'],
      desc:'Tear out a crumbling 26×24 garage floor and repour with a hard machine-trowel finish. Coach wants to be able to wrench on his ’66 Chevelle without dust. You’ll need the power trowel for this one.' },
  },
  {
    id:5, title:'Chapter 5 — The Big Bid', repReq:60,
    intro:[
      ['📖','The city is rebuilding the plaza in front of City Hall — 2,400 square feet of public flatwork, ADA walks, the works. Sealed bids. The whole town will walk on this slab for the next forty years.'],
      ['😤','Big Mike (at the pre-bid meeting, sweating): "I’ll have you know my work speaks for itself." Somebody in the back coughs the word "hardware store." The room snickers.'],
      ['🧓','Dale: "This is the one, kid. Big yardage, multiple trucks, real spec sheet. You’ll want the skid steer for this — and bid it honest. The city checks references, and yours are poured all over town." (Requires: Skid Steer)'],
    ],
    storyJob: { type:'plaza', name:'City Hall Plaza', customer:'City of Cedar Falls', len:60, wid:40, thick:5, demo:true, needs:['skid'],
      desc:'The career job. 60×40 plaza, 5" thick, full tear-out of the old heaved flagstone mess. Spec sheet calls for air-entrained exterior mix, fiber, proper jointing pattern, broom finish. Forty years of foot traffic will grade your work.' },
    final:true,
  },
];

const REVIEWS = [
  { min:92, stars:'★★★★★', texts:['"Flattest work in the county. You can tell he gives a dang." ','"Broom lines straight as a church pew. Worth every penny."','"My neighbor is jealous and I am thriving."'] },
  { min:78, stars:'★★★★☆', texts:['"Real solid work. Couple little things, but I’d hire him again."','"Showed up on time, slab looks great. Recommended."'] },
  { min:60, stars:'★★★☆☆', texts:['"It’s... fine. It’s concrete. It’s flat-ish."','"Decent job but I’ve seen better edges on a gravel road."'] },
  { min:40, stars:'★★☆☆☆', texts:['"Already seeing some issues. Called him about it."','"My kid’s handprint is the best looking part of this slab."'] },
  { min:0,  stars:'★☆☆☆☆', texts:['"Should have gone with Big Mike. And Big Mike is TERRIBLE."','"The slab failed. The vibes failed. Everything failed."'] },
];

const CRETEPEDIA = [
  ['Bag (Sack) Count', 'How many 94-lb bags of portland cement per cubic yard. 5-bag is lean/cheap, 6-bag is the workhorse (~4,000 PSI), 7-bag is rich mix for driveways and exterior work that takes weather and wheel loads. More bags = stronger and more expensive — but way over-rich mixes shrink and crack more.'],
  ['Air Entrainment', 'Microscopic air bubbles batched into the mix (target 5–7% for exterior). Gives freezing water somewhere to expand so the surface doesn’t scale off in winter. ALWAYS spec air outside in freeze-thaw country. NEVER hard-trowel high-air concrete inside — the densified surface traps the air and delaminates.'],
  ['Microfiber', 'Synthetic microfibers batched into the mix. They knit the concrete together while it’s young and cut down on plastic-shrinkage cracking. Cheap insurance on driveways and exterior flatwork.'],
  ['Non-Chloride Accelerator (NCA)', 'Speeds up set time without the corrosion problems of calcium chloride. Spec 1% on a cold pour (below ~50°F), 2% when it’s really cold. Skip it on a warm day or the mud will set faster than you can finish it.'],
  ['Low Chert Aggregate', 'Chert is a porous rock that soaks up water, freezes, and pops a cone of concrete off the surface (popouts). Low-chert washed aggregate costs a little more and keeps exterior surfaces clean for decades.'],
  ['Slump', 'How wet/flowable the mix is (inches of sag on a slump cone). 4–5" places nicely for flatwork. Soupy 7" mud is easy to push but weak and prone to shrinkage. Stiff 2" mud will blow up your back and your truck time.'],
  ['Yardage Math', 'Length × Width × (Thickness ÷ 12) ÷ 27 = cubic yards. Always add ~5–10% for waste and uneven subgrade. Under-order and you pay a short-load fee for a second truck while a cold joint forms. Over-order and you’re paying to landfill good mud.'],
  ['Flow Lines / Fall', 'Water has to leave the slab. Set forms with consistent fall AWAY from structures — about 1/8" to 1/4" per foot. A low spot in the middle is a "bird bath" and the customer will find it the first time it rains.'],
  ['Control Joints', 'Concrete cracks — your job is to tell it WHERE. Tool or saw joints to 1/4 of slab depth, spaced (in feet) at about 2.5× the thickness in inches: 4" slab → max ~10 ft. Keep panels close to square (aspect under ~1.5:1) or cracks cut the corner on you.'],
  ['Bleed Water', 'After screeding, water rises to the surface. Bull float right away, then WAIT until the sheen evaporates. Finish bleed water back into the surface and you weaken it — dusting, scaling, flaking come spring.'],
  ['Broom vs. Hard Trowel', 'Exterior gets a broom finish for traction (and it’s air-entrained, so no hard trowel anyway). Interior garage/shop floors get power-trowel passes for a dense, smooth, dust-free surface — on a LOW-air mix.'],
  ['Demurrage', 'The batch plant gives you a set unload time per truck. Go over and they bill you by the minute. A clean, fast pour plan isn’t just pro — it’s profit.'],
];

// ---- Crew -----------------------------------------------------------------

// which town lot each chapter's story job sits on (lot 0 = shop, lot 4 = City Hall)
const STORY_LOTS = { 1: 2, 2: 7, 3: 8, 4: 6, 5: 4 };

const CREW_TRAITS = [
  { id:'fast',     name:'Fast Hands',    icon:'⚡', desc:'Demo hits count double. Grew up swinging a maul.' },
  { id:'screed',   name:'Screed Wizard', icon:'📏', desc:'+1 section placed per pass on pour day.' },
  { id:'finisher', name:'Old Pro',       icon:'🎯', desc:'Finishing timing windows are 15% wider. Has opinions about your edger.' },
  { id:'steady',   name:'Steady Eye',    icon:'👁️', desc:'Reads the string line like a laser when setting forms.' },
  { id:'cheap',    name:'Works for Gas Money', icon:'⛽', desc:'No special skills, but the price is right.' },
];

const CREW_NAMES = ['Duane','Cletus','Shawna','Bogdan','T-Bone','Ruthie','Half-Stick','Merle','Junior','Peggy','Vlad','Skeeter','Donna','Curtis','Moose','Irene','Lyle','Tammy'];
const CREW_BIOS = [
  'Left the roofing crew "over creative differences."',
  'Can back a trailer into anything. Anything.',
  'Brings a cooler. Never says what’s in it.',
  'Third generation flatworker. Hates Big Mike on principle.',
  'Talks to the concrete. The concrete listens.',
  'Got fired by Big Mike for "doing it too good."',
  'Eats lunch standing up, staring at the slab.',
  'Once bull-floated a slab during a hailstorm. Won’t elaborate.',
];

const DALE_TIPS = {
  bid:    'Dale: "Walk the job, measure it, price it fair. My cheat sheet: rate per square foot times the footage, plus demo if you’re tearing out. Bid too high you lose the job, too low you work for free."',
  demo:   'Dale: "Bust it into chunks you can actually lift. Faster you clear it, less you bleed in labor. Equipment turns demo from a funeral into a Tuesday."',
  forms:  'Dale: "Forms are the whole job. Set your fall 1/8 to 1/4 inch per foot AWAY from the structure. String it, check it twice. No bird baths — water that can’t leave a slab moves in rent-free."',
  order:  'Dale: "Talk to the plant like a pro: yards, bags, air, fiber, accelerator. L times W times depth over 12, over 27, plus waste. Exterior gets AIR. Cold gets NCA. Interior trowel work gets LOW air. You got this."',
  pour:   'Dale: "Truck’s on the clock — demurrage ain’t a charity. Place it, pull it, screed it off. Don’t let the chute outrun your screed."',
  joints: 'Dale: "Thickness in inches times two-and-a-half gives you max spacing in feet. Keep panels squarish. Concrete WILL crack — a pro decides where."',
  finish: 'Dale: "Bull float right behind the screed. Then hands in pockets till the bleed water sheen burns off. Edge it, joint it, broom it in the window. Finishing is jazz — timing is everything."',
};
