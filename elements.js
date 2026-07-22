// Element categories and their reference-table-inspired colors.
const CATEGORY_META = {
  'alkali-metal':        { label: 'Alkali metal',         color: '#f5d7a3' },
  'alkaline-earth-metal':{ label: 'Alkaline-earth metal', color: '#f2a53e' },
  'transition-metal':    { label: 'Transition metal',     color: '#c9c6ea' },
  'post-transition-metal':{ label: 'Other metal',         color: '#f7c6ce' },
  'metalloid':           { label: 'Metalloid',            color: '#e8b98f' },
  'reactive-nonmetal':   { label: 'Other nonmetal',       color: '#f08767' },
  'halogen':             { label: 'Halogen',               color: '#8fbc8f' },
  'noble-gas':           { label: 'Noble gas',             color: '#ffffff' },
  'lanthanide':          { label: 'Rare-earth (lanthanide)', color: '#d9db84' },
  'actinide':            { label: 'Actinoid',              color: '#a8d5e8' },
};

// z, symbol, name, category, group (1-18, null for f-block), period, mass (display string), electronegativity (Pauling, null if not taught/uncertain)
const ELEMENTS = [
  [1,'H','Hydrogen','reactive-nonmetal',1,1,'1.008',2.20],
  [2,'He','Helium','noble-gas',18,1,'4.003',null],
  [3,'Li','Lithium','alkali-metal',1,2,'6.94',0.98],
  [4,'Be','Beryllium','alkaline-earth-metal',2,2,'9.012',1.57],
  [5,'B','Boron','metalloid',13,2,'10.81',2.04],
  [6,'C','Carbon','reactive-nonmetal',14,2,'12.011',2.55],
  [7,'N','Nitrogen','reactive-nonmetal',15,2,'14.007',3.04],
  [8,'O','Oxygen','reactive-nonmetal',16,2,'15.999',3.44],
  [9,'F','Fluorine','halogen',17,2,'18.998',3.98],
  [10,'Ne','Neon','noble-gas',18,2,'20.180',null],
  [11,'Na','Sodium','alkali-metal',1,3,'22.990',0.93],
  [12,'Mg','Magnesium','alkaline-earth-metal',2,3,'24.305',1.31],
  [13,'Al','Aluminium','post-transition-metal',13,3,'26.982',1.61],
  [14,'Si','Silicon','metalloid',14,3,'28.085',1.90],
  [15,'P','Phosphorus','reactive-nonmetal',15,3,'30.974',2.19],
  [16,'S','Sulfur','reactive-nonmetal',16,3,'32.06',2.58],
  [17,'Cl','Chlorine','halogen',17,3,'35.45',3.16],
  [18,'Ar','Argon','noble-gas',18,3,'39.948',null],
  [19,'K','Potassium','alkali-metal',1,4,'39.098',0.82],
  [20,'Ca','Calcium','alkaline-earth-metal',2,4,'40.078',1.00],
  [21,'Sc','Scandium','transition-metal',3,4,'44.956',1.36],
  [22,'Ti','Titanium','transition-metal',4,4,'47.867',1.54],
  [23,'V','Vanadium','transition-metal',5,4,'50.942',1.63],
  [24,'Cr','Chromium','transition-metal',6,4,'51.996',1.66],
  [25,'Mn','Manganese','transition-metal',7,4,'54.938',1.55],
  [26,'Fe','Iron','transition-metal',8,4,'55.845',1.83],
  [27,'Co','Cobalt','transition-metal',9,4,'58.933',1.88],
  [28,'Ni','Nickel','transition-metal',10,4,'58.693',1.91],
  [29,'Cu','Copper','transition-metal',11,4,'63.546',1.90],
  [30,'Zn','Zinc','transition-metal',12,4,'65.38',1.65],
  [31,'Ga','Gallium','post-transition-metal',13,4,'69.723',1.81],
  [32,'Ge','Germanium','metalloid',14,4,'72.630',2.01],
  [33,'As','Arsenic','metalloid',15,4,'74.922',2.18],
  [34,'Se','Selenium','reactive-nonmetal',16,4,'78.971',2.55],
  [35,'Br','Bromine','halogen',17,4,'79.904',2.96],
  [36,'Kr','Krypton','noble-gas',18,4,'83.798',null],
  [37,'Rb','Rubidium','alkali-metal',1,5,'85.468',0.82],
  [38,'Sr','Strontium','alkaline-earth-metal',2,5,'87.62',0.95],
  [39,'Y','Yttrium','transition-metal',3,5,'88.906',1.22],
  [40,'Zr','Zirconium','transition-metal',4,5,'91.224',1.33],
  [41,'Nb','Niobium','transition-metal',5,5,'92.906',1.6],
  [42,'Mo','Molybdenum','transition-metal',6,5,'95.95',2.16],
  [43,'Tc','Technetium','transition-metal',7,5,'(98)',1.9],
  [44,'Ru','Ruthenium','transition-metal',8,5,'101.07',2.2],
  [45,'Rh','Rhodium','transition-metal',9,5,'102.906',2.28],
  [46,'Pd','Palladium','transition-metal',10,5,'106.42',2.20],
  [47,'Ag','Silver','transition-metal',11,5,'107.868',1.93],
  [48,'Cd','Cadmium','transition-metal',12,5,'112.414',1.69],
  [49,'In','Indium','post-transition-metal',13,5,'114.818',1.78],
  [50,'Sn','Tin','post-transition-metal',14,5,'118.71',1.96],
  [51,'Sb','Antimony','metalloid',15,5,'121.76',2.05],
  [52,'Te','Tellurium','metalloid',16,5,'127.6',2.1],
  [53,'I','Iodine','halogen',17,5,'126.904',2.66],
  [54,'Xe','Xenon','noble-gas',18,5,'131.293',null],
  [55,'Cs','Caesium','alkali-metal',1,6,'132.905',0.79],
  [56,'Ba','Barium','alkaline-earth-metal',2,6,'137.327',0.89],
  [57,'La','Lanthanum','transition-metal',3,6,'138.905',1.10],
  [58,'Ce','Cerium','lanthanide',null,6,'140.116',1.12],
  [59,'Pr','Praseodymium','lanthanide',null,6,'140.908',1.13],
  [60,'Nd','Neodymium','lanthanide',null,6,'144.242',1.14],
  [61,'Pm','Promethium','lanthanide',null,6,'(145)',1.13],
  [62,'Sm','Samarium','lanthanide',null,6,'150.36',1.17],
  [63,'Eu','Europium','lanthanide',null,6,'151.964',1.2],
  [64,'Gd','Gadolinium','lanthanide',null,6,'157.25',1.2],
  [65,'Tb','Terbium','lanthanide',null,6,'158.925',1.1],
  [66,'Dy','Dysprosium','lanthanide',null,6,'162.500',1.22],
  [67,'Ho','Holmium','lanthanide',null,6,'164.930',1.23],
  [68,'Er','Erbium','lanthanide',null,6,'167.259',1.24],
  [69,'Tm','Thulium','lanthanide',null,6,'168.934',1.25],
  [70,'Yb','Ytterbium','lanthanide',null,6,'173.045',1.1],
  [71,'Lu','Lutetium','lanthanide',null,6,'174.967',1.27],
  [72,'Hf','Hafnium','transition-metal',4,6,'178.486',1.3],
  [73,'Ta','Tantalum','transition-metal',5,6,'180.948',1.5],
  [74,'W','Tungsten','transition-metal',6,6,'183.84',2.36],
  [75,'Re','Rhenium','transition-metal',7,6,'186.207',1.9],
  [76,'Os','Osmium','transition-metal',8,6,'190.23',2.2],
  [77,'Ir','Iridium','transition-metal',9,6,'192.217',2.2],
  [78,'Pt','Platinum','transition-metal',10,6,'195.084',2.28],
  [79,'Au','Gold','transition-metal',11,6,'196.967',2.54],
  [80,'Hg','Mercury','transition-metal',12,6,'200.592',2.00],
  [81,'Tl','Thallium','post-transition-metal',13,6,'204.38',1.62],
  [82,'Pb','Lead','post-transition-metal',14,6,'207.2',2.33],
  [83,'Bi','Bismuth','post-transition-metal',15,6,'208.980',2.02],
  [84,'Po','Polonium','post-transition-metal',16,6,'(209)',2.0],
  [85,'At','Astatine','halogen',17,6,'(210)',2.2],
  [86,'Rn','Radon','noble-gas',18,6,'(222)',null],
  [87,'Fr','Francium','alkali-metal',1,7,'(223)',0.7],
  [88,'Ra','Radium','alkaline-earth-metal',2,7,'(226)',0.9],
  [89,'Ac','Actinium','transition-metal',3,7,'(227)',1.1],
  [90,'Th','Thorium','actinide',null,7,'232.038',1.3],
  [91,'Pa','Protactinium','actinide',null,7,'231.036',1.5],
  [92,'U','Uranium','actinide',null,7,'238.029',1.38],
  [93,'Np','Neptunium','actinide',null,7,'(237)',1.36],
  [94,'Pu','Plutonium','actinide',null,7,'(244)',1.28],
  [95,'Am','Americium','actinide',null,7,'(243)',1.3],
  [96,'Cm','Curium','actinide',null,7,'(247)',1.3],
  [97,'Bk','Berkelium','actinide',null,7,'(247)',1.3],
  [98,'Cf','Californium','actinide',null,7,'(251)',1.3],
  [99,'Es','Einsteinium','actinide',null,7,'(252)',1.3],
  [100,'Fm','Fermium','actinide',null,7,'(257)',1.3],
  [101,'Md','Mendelevium','actinide',null,7,'(258)',1.3],
  [102,'No','Nobelium','actinide',null,7,'(259)',1.3],
  [103,'Lr','Lawrencium','actinide',null,7,'(262)',1.3],
  [104,'Rf','Rutherfordium','transition-metal',4,7,'(267)',null],
  [105,'Db','Dubnium','transition-metal',5,7,'(268)',null],
  [106,'Sg','Seaborgium','transition-metal',6,7,'(271)',null],
  [107,'Bh','Bohrium','transition-metal',7,7,'(272)',null],
  [108,'Hs','Hassium','transition-metal',8,7,'(270)',null],
  [109,'Mt','Meitnerium','transition-metal',9,7,'(276)',null],
  [110,'Ds','Darmstadtium','transition-metal',10,7,'(281)',null],
  [111,'Rg','Roentgenium','transition-metal',11,7,'(280)',null],
  [112,'Cn','Copernicium','transition-metal',12,7,'(285)',null],
  [113,'Nh','Nihonium','post-transition-metal',13,7,'(286)',null],
  [114,'Fl','Flerovium','post-transition-metal',14,7,'(289)',null],
  [115,'Mc','Moscovium','post-transition-metal',15,7,'(288)',null],
  [116,'Lv','Livermorium','post-transition-metal',16,7,'(293)',null],
  [117,'Ts','Tennessine','halogen',17,7,'(294)',null],
  [118,'Og','Oganesson','noble-gas',18,7,'(294)',null],
].map(([z,symbol,name,category,group,period,mass,en]) => ({ z, symbol, name, category, group, period, mass, en }));

const ELEMENTS_BY_Z = {};
ELEMENTS.forEach(e => { ELEMENTS_BY_Z[e.z] = e; });

// Subshells in Aufbau fill order: [principal shell n, sublevel, capacity]
const SUBSHELL_ORDER = [
  [1,'s',2],[2,'s',2],[2,'p',6],[3,'s',2],[3,'p',6],[4,'s',2],[3,'d',10],[4,'p',6],
  [5,'s',2],[4,'d',10],[5,'p',6],[6,'s',2],[4,'f',14],[5,'d',10],[6,'p',6],
  [7,'s',2],[5,'f',14],[6,'d',10],[7,'p',6],
];

// Returns electrons-per-shell array, e.g. Silicon -> [2,8,4]
function shellConfig(z) {
  let remaining = z;
  const shells = [0,0,0,0,0,0,0];
  for (const [n, , cap] of SUBSHELL_ORDER) {
    if (remaining <= 0) break;
    const put = Math.min(cap, remaining);
    shells[n - 1] += put;
    remaining -= put;
  }
  while (shells.length && shells[shells.length - 1] === 0) shells.pop();
  return shells;
}

// Returns filled subshells in Aufbau fill order, e.g. Niobium -> [{n:1,l:'s',count:2}, ...]
function subshellBreakdown(z) {
  let remaining = z;
  const filled = [];
  for (const [n, l, cap] of SUBSHELL_ORDER) {
    if (remaining <= 0) break;
    const put = Math.min(cap, remaining);
    filled.push({ n, l, count: put });
    remaining -= put;
  }
  return filled;
}

function metallicCharacter(category) {
  if (category === 'metalloid') return 'Metalloid';
  if (category === 'reactive-nonmetal' || category === 'halogen') return 'Nonmetal';
  if (category === 'noble-gas') return 'Nonmetal (inert)';
  return 'Metal';
}

function reactivityLabel(category) {
  switch (category) {
    case 'alkali-metal': return 'Very high';
    case 'alkaline-earth-metal': return 'High';
    case 'halogen': return 'Very high';
    case 'reactive-nonmetal': return 'High';
    case 'metalloid': return 'Moderate';
    case 'post-transition-metal': return 'Moderate';
    case 'noble-gas': return 'Very low (inert)';
    default: return 'Variable';
  }
}

const TRANSITION_CATEGORIES = new Set(['transition-metal', 'lanthanide', 'actinide']);
