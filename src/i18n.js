// English / Spanish. English is the source: every string the page shows is written
// in English and looked up here when the page is in Spanish; a missing entry
// falls back to English. Static markup marks its text with data-i18n.

const ES = {
  // top bar, start screen, tutorial
  'Auditory epidemiology': 'Epidemiología auditiva',
  'Case': 'Caso',
  'Respiratory virus: Simulation': 'Virus respiratorio: simulación',
  'Two EBOV Outbreaks': 'Dos brotes de EBOV',
  'EBOV Western Africa 2014': 'EBOV África Occidental 2014',
  'Comparison': 'Comparativa',
  'Kasai in outline': 'Kasai en contorno',
  'Sound off': 'Quitar el sonido',
  'Sound on': 'Poner el sonido',
  'Real data': 'Datos reales',
  'A contained outbreak, then one that got away': 'Un brote contenido y, después, otro que se escapó',
  'Toggle light and dark': 'Cambiar entre claro y oscuro',
  'Every case is one drop.': 'Cada caso es una gota.',
  'Rain is what an outbreak sounds like.': 'La lluvia es como suena un brote.',
  'Headphones recommended. Each infection in the model sounds once, on the surface of its lineage.': 'Mejor con auriculares. Cada infección del modelo suena una vez, sobre la superficie de su linaje.',
  'Listen': 'Escuchar',
  'Watch in silence': 'Ver en silencio',
  'A new variant': 'Una variante nueva',
  'Deaths': 'Muertes',
  'Rain': 'Lluvia',

  // stage
  'One drop = one case · colour = lineage': 'Una gota = un caso · color = linaje',
  'Day': 'Día',
  'Onsets / day': 'Casos nuevos / día',
  'Cases / day': 'Casos / día',
  'Cumulative': 'Acumulados',
  'cases per day, by onset': 'casos por día, según el inicio de síntomas',
  'reported cases per week': 'casos notificados por semana',
  'cases per day, days since the first case': 'casos por día, días desde el primer caso',
  'founder virus': 'virus fundador',
  'brought in from outside': 'llegado de fuera',
  'new variant': 'variante nueva',
  'cases in': 'casos en',
  'outbreak': 'brote',
  'sound': 'sonido',
  'muted': 'silenciado',
  'base tone': 'tono base',
  'brighter': 'más brillante',
  'darker': 'más oscuro',
  'lighter': 'más ligero',
  'an extra low knock per death': 'un golpe grave más por cada muerte',
  'reported': 'notificado',
  'never reported': 'nunca notificado',
  'click a line to mute or unmute its sound': 'toca una línea para silenciar o activar su sonido',
  "Mute this lineage's sound": 'Silenciar el sonido de este linaje',
  "Unmute this lineage's sound": 'Activar el sonido de este linaje',
  'Mute the extra low sound played for each death': 'Silenciar el sonido grave que suena por cada muerte',
  'Unmute the extra low sound played for each death': 'Activar el sonido grave que suena por cada muerte',
  'Go back to': 'Volver a',

  // lineages
  'Founder': 'Fundador',
  'Imported': 'Importado',
  'Sierra Leone': 'Sierra Leona',
  'Guinea': 'Guinea',
  'Liberia': 'Liberia',
  'Nextstrain · ebola': 'Nextstrain · ebola',
  'CC BY-SA 4.0': 'CC BY-SA 4.0',
  'Elsewhere': 'Otros lugares',
  'Kasai, DRC 2025': 'Kasai, RDC 2025',
  'Bundibugyo · DRC': 'Bundibugyo · RDC',
  'Bundibugyo · Uganda': 'Bundibugyo · Uganda',
  'Bundibugyo · elsewhere': 'Bundibugyo · otros países',

  // controls
  'Controls': 'Controles',
  'Transport': 'Reproducción',
  'Play': 'Reproducir',
  'Pause': 'Pausa',
  'Reset': 'Reiniciar',
  'Sound': 'Sonido',
  'Speed': 'Velocidad',
  'model days per second': 'días del modelo por segundo',
  'Volume': 'Volumen',
  'Key': 'Cómo leerlo',
  'Everywhere': 'Por todas partes',
  'Over today': 'Sobre hoy',
  'Scale': 'Escala',
  'Linear': 'Lineal',
  'Log': 'Logarítmica',
  "Each drop is one case. As it hits the ground, today's bar grows by one: the bars are the rain that has already fallen. Solid = reported, faint = never reported. Colours are lineages; the thin labelled lines mark what happened in the story.": 'Cada gota es un caso. Cuando toca el suelo, la barra de hoy crece en uno: las barras son la lluvia que ya ha caído. Macizo = notificado; tenue = nunca notificado. Los colores son linajes; las líneas finas con rótulo marcan lo que pasó en la historia.',
  'Chapters': 'Capítulos',
  'Transmission': 'Transmisión',
  'Discontinuities': 'Discontinuidades',
  'New variant': 'Variante nueva',
  'Import pulse': 'Oleada importada',
  'Transmission <var>β</var>': 'Transmisión <var>β</var>',
  'per day, founder lineage': 'por día, linaje fundador',
  'Infectious period': 'Periodo infeccioso',
  'mean days': 'días de media',
  'Vaccination target': 'Objetivo de vacunación',
  'share of population': 'parte de la población',
  'Reporting': 'Notificación',
  'probability a case is reported': 'probabilidad de que un caso se notifique',
  'Sequencing': 'Secuenciación',
  'share of reported cases sequenced': 'parte de los casos notificados que se secuencian',
  'Imports': 'Importaciones',
  'per day, fall on leaves': 'por día, caen sobre hojas',
  'Sound bank not generated yet. "Listen" will run silently for now.': 'El banco de sonidos aún no está generado. «Escuchar» funcionará en silencio por ahora.',

  // simulation story
  'Patient zero': 'Paciente cero',
  'A made-up respiratory virus reaches a population with no immunity. The first cases fall as single drops, and almost none are noticed.': 'Un virus respiratorio inventado llega a una población sin inmunidad. Los primeros casos caen como gotas sueltas y casi nadie los nota.',
  'Silent spread': 'Propagación silenciosa',
  'Each infection seeds two or three more. Without testing, the reported curve trails the real one. What sounds like drizzle is already an outbreak.': 'Cada infección siembra dos o tres más. Sin pruebas, la curva notificada va por detrás de la real. Lo que suena a llovizna ya es un brote.',
  'Exponential': 'Exponencial',
  'The exponential wall': 'El muro exponencial',
  'Doublings stack. A handful becomes hundreds a day within weeks. Single drops merge into rain.': 'Las duplicaciones se acumulan. Un puñado se convierte en cientos al día en pocas semanas. Las gotas sueltas se funden en lluvia.',
  'Lockdown': 'Confinamiento',
  'Distancing and closures cut transmission per contact. R falls below one. The rain thins, but it does not stop.': 'La distancia y los cierres reducen la transmisión por contacto. R baja de uno. La lluvia afloja, pero no para.',
  'Plateau': 'Meseta',
  'A long plateau': 'Una larga meseta',
  'Cases settle into a low murmur. Mobility returns, transmission creeps back toward one, and travellers seed new clusters.': 'Los casos se quedan en un murmullo bajo. La movilidad vuelve, la transmisión se acerca otra vez a uno y los viajeros siembran nuevos focos.',
  'A more transmissible lineage arises in one infected person. Thunder marks the moment; from then on its drops fall a little brighter.': 'En una persona infectada surge un linaje más transmisible. Un trueno marca el momento; desde entonces sus gotas caen un poco más brillantes.',
  'Second wave': 'Segunda ola',
  'With the variant dominant, R climbs above one again even as testing improves. The brighter drops multiply. Left alone, this wave would outgrow the first.': 'Con la variante dominando, R vuelve a superar uno aunque haya más pruebas. Las gotas brillantes se multiplican. Sin hacer nada, esta ola superaría a la primera.',
  'Vaccines': 'Vacunas',
  'Vaccines arrive': 'Llegan las vacunas',
  'Each vaccinated person moves from susceptible to immune without ever being infected. The fuel is removed, person by person, and the wave turns.': 'Cada persona vacunada pasa de susceptible a inmune sin llegar a infectarse. El combustible se retira, persona a persona, y la ola da la vuelta.',
  'A partial-escape variant': 'Una variante que escapa en parte',
  'A second variant evades some immunity; its drops fall darker. Cases rise again, but the peak is lower: imperfect immunity still dampens the curve.': 'Una segunda variante esquiva parte de la inmunidad; sus gotas caen más oscuras. Los casos suben de nuevo, pero el pico es más bajo: una inmunidad imperfecta sigue frenando la curva.',
  'Endemic': 'Endemia',
  'Endemic rain': 'Lluvia endémica',
  'The virus settles into a low, persistent rain. The storm has not ended; it has changed surface. This is what living with a pathogen sounds like.': 'El virus se asienta en una lluvia baja y persistente. La tormenta no ha terminado; ha cambiado de superficie. Así suena convivir con un patógeno.',

  // sources
  'Source · simulated': 'Fuente · simulada',
  'Simulated. Stochastic SEIR (chain-binomial, 100,000 people) in which every infection records its infector. The tree is the time-resolved ancestry of sequenced cases; variants arise as mutations on one branch. Clinical attributes are drawn from fixed distributions.': 'Simulado. Un modelo epidémico aleatorio de 100.000 personas (susceptibles, expuestas, infecciosas y recuperadas) en el que cada infección registra quién la contagió. El árbol es el parentesco en el tiempo de los casos secuenciados; las variantes surgen como mutaciones en una rama. Los datos clínicos se sortean con distribuciones fijas.',
  'Source · observed': 'Fuente · observada',
  'Source · observed, compared': 'Fuente · observada, comparada',
  'Transformations': 'Transformaciones',
  'Inferred:': 'Inferido:',
  'severity and outcome of individual cases are sampled': 'la gravedad y el desenlace de cada caso se sortean',
  'fatal': 'mortales',
  'not observed. Drops within a week are spread evenly; their timing inside the week is not data.': 'no se observan. Las gotas de una semana se reparten por igual; su momento dentro de la semana no es un dato.',

  // observed: West Africa
  'West Africa, 2013–2016': 'África Occidental, 2013–2016',
  'Ebola virus, Zaire species (the Makona variant). 21,803 reported cases in Guinea, Sierra Leone and Liberia, one drop each, week by week. 1,493 genomes grow the tree as their sampling dates arrive.': 'Virus del Ébola, especie Zaire (variante Makona). 21.803 casos notificados en Guinea, Sierra Leona y Liberia, una gota cada uno, semana a semana. 1.493 genomas hacen crecer el árbol según llegan sus fechas de muestreo.',
  'Time-resolved phylogeny of Makona genomes; Dudas et al., Nature 544:309 (2017). Build updated 2019-12-14.': 'Filogenia en el tiempo de los genomas Makona; Dudas y cols., Nature 544:309 (2017). Versión actualizada el 14-12-2019.',
  'ebov/space-time · weekly cases by district': 'ebov/space-time · casos semanales por distrito',
  'WHO patient database counts (max of confirmed and probable), compiled for Dudas et al. 2017.': 'Recuentos de la base de pacientes de la OMS (el mayor entre confirmados y probables), recopilados para Dudas y cols., 2017.',
  'see nextstrain.org': 'ver nextstrain.org',
  "Tree dates (decimal years) converted to days since 30 Dec 2013; tips coloured by sampling country; internal nodes inherit their parent's country when unannotated.": 'Fechas del árbol (años decimales) pasadas a días desde el 30 de diciembre de 2013; las puntas se colorean por país de muestreo; los nodos internos sin anotar heredan el país de su padre.',
  'District weekly counts summed to country; trailing empty weeks removed.': 'Recuentos semanales por distrito sumados por país; se quitan las semanas vacías del final.',
  "Each week's count is replayed as that many onsets spread evenly across the week.": 'El recuento de cada semana se reproduce como otros tantos casos repartidos por igual en la semana.',
  'At most 400 tips are drawn at once, thinned evenly over time.': 'Se dibujan como mucho 400 puntas a la vez, aclaradas por igual en el tiempo.',

  // compare
  'Kasai, DRC 2025: contained': 'Kasai, RDC 2025: contenido',
  'Ebola virus, Zaire species, in Bulape, Kasai province, DRC. 64 cases and 45 deaths. A vaccine existed: 47,577 people received it. The last case fell ill on 23 September; on 1 December the outbreak was declared over.': 'Virus del Ébola, especie Zaire, en Bulape, provincia de Kasai, República Democrática del Congo. 64 casos y 45 muertes. Había vacuna: la recibieron 47.577 personas. El último caso enfermó el 23 de septiembre; el 1 de diciembre se dio el brote por terminado.',
  'Bundibugyo 2026: not contained': 'Bundibugyo 2026: sin contener',
  'Bundibugyo virus, a different ebolavirus species, from Ituri to Uganda, Kenya and beyond. No approved vaccine or treatment. 10,699 confirmed cases and 5,202 deaths by 3 November, when it had not stopped.': 'Virus Bundibugyo, otra especie de ébola, de Ituri a Uganda, Kenia y más allá. Sin vacuna ni tratamiento aprobados. 10.699 casos confirmados y 5.202 muertes hasta el 3 de noviembre, y entonces no se había detenido.',
  'Declared': 'Declarado',
  'Last patient out': 'Alta del último paciente',
  'Over': 'Fin',
  'WHO · Disease Outbreak News, Ebola, DRC (DON580, DON589)': 'OMS · Partes de brotes, ébola, R. D. del Congo (DON580, DON589)',
  'Kasai 2025: 53 confirmed and 11 probable cases, 45 deaths; daily epidemic curve by symptom onset (Figure 2), as of 30 Nov 2025.': 'Kasai 2025: 53 casos confirmados y 11 probables, 45 muertes; curva epidémica diaria por inicio de síntomas (figura 2), a 30 de noviembre de 2025.',
  'WHO AFRO · end of the 16th Ebola outbreak': 'OMS África · fin del 16.º brote de ébola',
  '47,577 people vaccinated; outbreak declared over on 1 Dec 2025.': '47.577 personas vacunadas; brote dado por terminado el 1 de diciembre de 2025.',
  'WHO · Disease Outbreak News, Bundibugyo virus (DON602–DON625)': 'OMS · Partes de brotes, virus Bundibugyo (DON602–DON625)',
  'Bundibugyo 2026: confirmed cases by country, as of 3 Nov 2026 (DRC 10,668 confirmed, 5,198 deaths).': 'Bundibugyo 2026: casos confirmados por país, a 3 de noviembre de 2026 (R. D. del Congo: 10.668 confirmados, 5.198 muertes).',
  "Kasai 2025: each day's cases (confirmed and probable) read off WHO's epidemic curve by date of symptom onset; the read totals match WHO's 53 + 11.": 'Kasai 2025: los casos de cada día (confirmados y probables), leídos de la curva epidémica de la OMS por fecha de inicio de síntomas; los totales leídos coinciden con los 53 + 11 de la OMS.',
  "Bundibugyo 2026: confirmed cases by date of report, not of onset. Between two WHO reports the new cases are spread at a steady pace; each report's total is met exactly.": 'Bundibugyo 2026: casos confirmados por fecha de notificación, no de inicio. Entre dos partes de la OMS, los casos nuevos se reparten a ritmo constante; el total de cada parte se respeta exactamente.',
  'Bundibugyo 2026: before 10 June WHO counted only suspected cases; the 676 confirmed by then are spread on a rising ramp from the first known onset (24 April).': 'Bundibugyo 2026: antes del 10 de junio la OMS solo contaba casos sospechosos; los 676 confirmados hasta entonces se reparten en una rampa creciente desde el primer inicio conocido (24 de abril).',
  "Bundibugyo 2026: the jump in the second half of July includes WHO's data reconciliation of 22 July, not only new illness.": 'Bundibugyo 2026: el salto de la segunda quincena de julio incluye la revisión de datos que hizo la OMS el 22 de julio, no solo enfermos nuevos.',
  'Both outbreaks start at day 0 = the first known case, and share the same speed, axis and vertical scale. Kasai stays on the axis as outlines while Bundibugyo falls.': 'Los dos brotes empiezan en el día 0 = el primer caso conocido, y comparten velocidad, eje y escala vertical. Kasai se queda en el eje como contornos mientras cae Bundibugyo.',
  'Deaths match the reported totals (45; 5,202), but which cases died, and on which day, is drawn at random: the data does not say.': 'Las muertes coinciden con los totales notificados (45; 5.202), pero qué casos murieron, y qué día, se sortea: los datos no lo dicen.',
};

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
};

let lang = 'en';
const listeners = new Set();

export const getLang = () => lang;
// Which language to open in: ?lang= wins, then the viewer's saved choice, else
// English. The browser's language is not used: the page opens in English first.
export function pickLang({ param, saved } = {}) {
  for (const v of [param, saved]) if (v === 'es' || v === 'en') return v;
  return 'en';
}
export function setLang(l) {
  lang = l === 'es' ? 'es' : 'en';
  for (const f of listeners) f(lang);
}
export const onLangChange = (f) => listeners.add(f);

export const t = (s) => (lang === 'es' && s != null ? ES[s] ?? s : s);
// lineage names: simulated variants are numbered with Greek letters ("Variant α")
export const tName = (s) => (lang === 'es' && /^Variant /.test(s ?? '') ? s.replace(/^Variant /, 'Variante ') : t(s));
export const num = (n) => n.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US');
export const month = (i) => MONTHS[lang][i];

// Static markup: data-i18n swaps the element's text; data-i18n-attr="title,aria-label"
// swaps those attributes. The English original is kept on the element.
export function translateDom(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    if (el.dataset.en == null) el.dataset.en = el.textContent.trim();
    el.textContent = t(el.dataset.en);
  }
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const a of el.dataset.i18nAttr.split(',')) {
      const key = `en${a.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}`;
      if (el.dataset[key] == null) el.dataset[key] = el.getAttribute(a) ?? '';
      el.setAttribute(a, t(el.dataset[key]));
    }
  }
}

export const ES_STRINGS = ES;   // for tests
