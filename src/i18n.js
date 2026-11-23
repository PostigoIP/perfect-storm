// English / Spanish. English is the source: every string the page shows is written
// in English and looked up here when the page is in Spanish; a missing entry
// falls back to English. Static markup marks its text with data-i18n.

const ES = {
  // top bar, start screen, tutorial
  'Auditory epidemiology': 'Epidemiología auditiva',
  'Case': 'Caso',
  'Respiratory virus (simulation)': 'Virus respiratorio (simulación)',
  'Two Ebola outbreaks': 'Dos brotes de ébola',
  'Ebola in West Africa, 2014': 'Ébola en África Occidental, 2014',
  'Ebola 2014': 'Ébola 2014',   // the same tab, on phones
  'Comparison': 'Comparativa',
  'the outline is Kasai': 'el contorno es Kasai',
  'Kasai, DRC, 2025': 'Kasai, RDC, 2025',
  'Ituri, DRC, 2026': 'Ituri, RDC, 2026',
  'Mute': 'Silenciar',
  'Unmute': 'Activar sonido',
  'Real data': 'Datos reales',
  'One contained outbreak, and another out of control': 'Un brote contenido y otro fuera de control',
  'Switch light and dark mode': 'Cambiar entre tema claro y oscuro',
  'Every case is a drop of rain.': 'Cada caso es una gota.',
  'Together, they sound like an outbreak.': 'Juntas, suenan como un brote.',
  'Headphones recommended. Each infection in the model plays once, landing on the surface assigned to its lineage.': 'Mejor con auriculares. Cada infección del modelo suena una vez, al caer sobre la superficie asignada a su linaje.',
  'Listen': 'Escuchar',
  'Watch without sound': 'Ver sin sonido',
  'Deaths': 'Muertes',
  'Rain': 'Lluvia',

  // stage
  'One drop = one case · colour = lineage': 'Una gota = un caso · color = linaje',
  'Day': 'Día',
  'Onsets / day': 'Casos nuevos / día',
  'Cases / day': 'Casos / día',
  'Cumulative': 'Acumulados',
  'cases per day, by symptom onset': 'casos al día, por inicio de síntomas',
  'reported cases per week': 'casos notificados por semana',
  'cases per day, since the first case': 'casos al día, desde el primer caso',
  'founder virus': 'virus fundador',
  'imported from outside': 'importado del exterior',
  'new variant': 'variante nueva',
  'cases in': 'casos en',
  'outbreak': 'brote',
  'sound': 'sonido',
  'muted': 'silenciado',
  'base tone': 'tono base',
  'brighter': 'más brillante',
  'darker': 'más oscuro',
  'lighter': 'más ligero',
  'an extra low knock for each death': 'un golpe grave adicional por cada muerte',
  'reported': 'notificado',
  'unreported': 'no notificado',
  'click a line to mute or unmute its sound': 'pulsa una línea para silenciar o activar su sonido',
  'Mute this lineage': 'Silenciar este linaje',
  'Unmute this lineage': 'Activar este linaje',
  'Mute the low knock for deaths': 'Silenciar el golpe grave de las muertes',
  'Unmute the low knock for deaths': 'Activar el golpe grave de las muertes',
  'Go back to': 'Volver a',

  // lineages
  'Founder': 'Fundador',
  'Imported': 'Importado',
  'Sierra Leone': 'Sierra Leona',
  'Guinea': 'Guinea',
  'Liberia': 'Liberia',
  'CC BY-SA 4.0': 'CC BY-SA 4.0',
  'Elsewhere': 'Otros lugares',
  'Kasai, DRC 2025': 'Kasai, RDC 2025',
  'Bundibugyo · DRC': 'Bundibugyo · RDC',
  'Bundibugyo · Uganda': 'Bundibugyo · Uganda',
  'Bundibugyo · elsewhere': 'Bundibugyo · otros países',

  // screen-reader labels
  'Storm view: cases fall as rain onto the epidemic curve': 'Vista de tormenta: los casos caen como lluvia sobre la curva epidémica',
  'Phylogenetic tree of sequenced cases, aligned on the same time axis as the case series': 'Árbol filogenético de los casos secuenciados, alineado con el mismo eje temporal que la serie de casos',
  'Milestones: select one to jump back to that moment': 'Hitos: selecciona uno para volver a ese momento',
  'Legend': 'Leyenda',
  'Controls and guide': 'Controles y guía',
  'Source': 'Fuente',

  // controls
  'Controls': 'Controles',
  'Playback': 'Reproducción',
  'Play': 'Reproducir',
  'Pause': 'Pausa',
  'Reset': 'Reiniciar',
  'Sound': 'Sonido',
  'Speed': 'Velocidad',
  'model days per second': 'días del modelo por segundo',
  'Volume': 'Volumen',
  'How to read it': 'Cómo leerlo',
  'Across the chart': 'En todo el gráfico',
  'Over today': 'Sobre el día actual',
  'Scale': 'Escala',
  'Linear': 'Lineal',
  'Log': 'Logarítmica',
  "Each drop represents one case. When it hits the ground, today's bar grows by one, so the bars show all the rain that has already fallen. Solid fill means reported; faint fill means unreported. Colours distinguish lineages, and the thin labelled lines mark key moments in the outbreak.": 'Cada gota representa un caso. Al tocar el suelo, la barra del día actual sube en una unidad, de modo que las barras acumulan la lluvia que ya ha caído. El relleno sólido indica casos notificados y el tenue, casos no notificados. Los colores distinguen los linajes, y las líneas finas con etiqueta marcan los hitos del brote.',
  'Chapters': 'Capítulos',
  'Transmission': 'Transmisión',
  'Discontinuities': 'Discontinuidades',
  'New variant': 'Variante nueva',
  'Import pulse': 'Oleada importada',
  'Transmission <var>β</var>': 'Transmisión <var>β</var>',
  'per day, founder lineage': 'al día, linaje fundador',
  'Infectious period': 'Periodo infeccioso',
  'mean days': 'días de media',
  'Vaccination target': 'Objetivo de vacunación',
  'share of population': 'proporción de la población',
  'Reporting': 'Notificación',
  'probability a case is reported': 'probabilidad de que un caso se notifique',
  'Sequencing': 'Secuenciación',
  'share of reported cases sequenced': 'proporción de casos notificados que se secuencian',
  'Imports': 'Importaciones',
  'per day, falling on leaves': 'al día, caen sobre hojas',
  'The sound bank has not been generated yet. "Listen" will play silently for now.': 'Aún no se ha generado el banco de sonidos. Por ahora, «Escuchar» se reproducirá en silencio.',

  // simulation story
  'Patient zero': 'Paciente cero',
  'A hypothetical respiratory virus reaches a population with no prior immunity. The first cases arrive as isolated drops, and almost none are detected.': 'Un virus respiratorio ficticio llega a una población sin inmunidad previa. Los primeros casos caen como gotas sueltas y casi ninguno es detectado.',
  'Silent spread': 'Propagación silenciosa',
  'Each infection leads to two or three more. Without diagnostic testing, the reported curve lags behind reality, and what still sounds like a light drizzle is already a storm underway.': 'Cada infección genera otras dos o tres. Sin realizar tests diagnósticos, la curva de casos notificados va por detrás de la real, y lo que todavía suena como una llovizna ya es una tormenta en marcha.',
  'Exponential': 'Crecimiento exponencial',
  'The exponential wall': 'El muro exponencial',
  'As cases double again and again, a handful turns into hundreds a day within weeks, and individual drops merge into steady rain.': 'A medida que los casos se duplican una y otra vez, un puñado pasa a ser cientos al día en pocas semanas, y las gotas sueltas se funden en una lluvia constante.',
  'Lockdown': 'Confinamiento',
  'Physical distancing and closures cut transmission per contact, pushing R below one. The rain eases, though it does not stop completely.': 'La distancia física y los cierres reducen la transmisión por contacto y hacen que R baje de uno. La lluvia afloja, aunque no llega a parar.',
  'Plateau': 'Meseta',
  'A long plateau': 'Una larga meseta',
  'Cases settle into a low background hum. As mobility returns, transmission creeps back toward one, and travellers seed new clusters.': 'Los casos se estabilizan en un goteo continuo. Al recuperarse la movilidad, la transmisión vuelve a acercarse a uno y los viajeros introducen nuevos focos.',
  'A more transmissible variant emerges in a single infected person. A clap of thunder marks the moment, and from then on its lineage sounds slightly brighter.': 'En una sola persona infectada surge una variante más transmisible. Un trueno marca ese momento y, a partir de ahí, su linaje suena algo más brillante.',
  'Second wave': 'Segunda ola',
  'Once the new variant takes over, R climbs back above one even with better testing. The brighter drops multiply; left unchecked, this wave would surpass the first.': 'Cuando la nueva variante se impone, R vuelve a superar uno aunque haya más pruebas. Las gotas brillantes se multiplican y, sin intervención, esta ola superaría a la primera.',
  'Vaccines': 'Vacunas',
  'Vaccines arrive': 'Llegan las vacunas',
  'Every vaccinated person moves from susceptible to immune without getting infected. As fewer susceptible people remain, the wave finally turns.': 'Cada persona vacunada pasa de susceptible a inmune sin llegar a infectarse. Al quedar cada vez menos población susceptible, la ola acaba remitiendo.',
  'A partial-escape variant': 'Una variante de escape parcial',
  'A second variant evades part of that immunity, and its drops sound darker. Cases rise again, though the peak stays lower because partial immunity still slows transmission.': 'Una segunda variante logra esquivar parte de esa inmunidad y sus gotas suenan más oscuras. Los casos vuelven a subir, pero el pico es más bajo porque la inmunidad parcial sigue frenando el contagio.',
  'Endemic': 'Endemia',
  'Endemic rain': 'Lluvia endémica',
  'Eventually, the virus settles into a low, persistent rain. It does not disappear; it becomes part of the auditory and epidemic background.': 'Con el tiempo, el virus se asienta en una lluvia suave y persistente. No desaparece, sino que pasa a formar parte del fondo sonoro y epidémico.',

  // sources
  'Source · simulated': 'Fuente · simulada',
  'This scenario is simulated using a stochastic SEIR model (chain-binomial, 100,000 people) in which every infection records who transmitted it. The tree shows the time-resolved ancestry of sequenced cases, and variants arise as mutations along a branch. Clinical attributes are sampled from fixed distributions.': 'Este escenario está simulado con un modelo SEIR estocástico (binomial en cadena, 100.000 personas) en el que cada infección registra quién la transmitió. El árbol muestra el parentesco temporal de los casos secuenciados y las variantes surgen como mutaciones en una rama. Los atributos clínicos se muestrean a partir de distribuciones fijas.',
  'Source · observed': 'Fuente · datos reales',
  'Source · observed, compared': 'Fuente · datos reales comparados',
  'Transformations': 'Transformaciones',
  'Code': 'Código',
  'Content': 'Contenido',
  'Data': 'Datos',
  'Source code': 'Código fuente',
  'WHO': 'OMS',
  'Inferred:': 'Inferido:',
  'the severity and outcome of individual cases are sampled': 'la gravedad y el desenlace de cada caso se asignan al azar',
  'fatal': 'mortales',
  'rather than observed. Drops within a week are spaced evenly, so their exact timing inside the week is not observed data.': 'y no provienen de observaciones directas. Las gotas de cada semana se reparten de forma uniforme, por lo que su momento exacto dentro de la semana no es un dato real.',

  // observed: West Africa
  'West Africa, 2013–2016': 'África Occidental, 2013–2016',
  'Ebola virus, Zaire species (Makona variant). Starting in Guinea in late 2013, the outbreak crossed into Sierra Leone and Liberia and became the largest Ebola epidemic on record. Here you hear 21,803 reported cases across the three countries, falling one drop at a time, week by week.': 'Virus del ébola, especie Zaire (variante Makona). Iniciado en Guinea a finales de 2013, el brote cruzó a Sierra Leona y Liberia hasta convertirse en la mayor epidemia de ébola registrada. Aquí suenan 21.803 casos notificados en los tres países, gota a gota y semana a semana.',
  'ebov/space-time · weekly cases by district': 'ebov/space-time · casos semanales por distrito',
  'Counts from the WHO patient database (taking the higher of confirmed and probable cases), compiled for Dudas et al. (2017).': 'Recuentos de la base de datos de pacientes de la OMS (tomando el valor mayor entre confirmados y probables), recopilados para Dudas y cols. (2017).',
  'Weekly district counts are summed by country, and trailing empty weeks are removed.': 'Los recuentos semanales por distrito se agrupan por país y se eliminan las semanas vacías al final de la serie.',
  "Each week's total is played back as an equal number of cases spaced evenly across the seven days.": 'El total de cada semana se reproduce como ese mismo número de casos repartidos de manera uniforme a lo largo de los siete días.',

  // compare
  'With a vaccine, a treatment and a remote rural area, the outbreak stopped at 64 cases.': 'Con vacuna, tratamiento y una zona rural aislada, el brote se frenó en 64 casos.',
  'Ebola virus (Zaire species) in a hard-to-reach rural area of Kasai, DRC. 47,577 people vaccinated; patients treated with antibodies. 64 cases and 45 deaths, all in one health zone; declared over on 1 December 2025.': 'Virus del ébola (especie Zaire) en una zona rural de difícil acceso de Kasai (RDC). 47.577 personas vacunadas; pacientes tratados con anticuerpos. 64 casos y 45 muertes, todos en una sola zona de salud; brote terminado el 1 de diciembre de 2025.',
  'With no vaccine, no treatment and a conflict zone, the outbreak reached 10,699 cases and has not stopped.': 'Sin vacuna, sin tratamiento y en zona de conflicto, el brote llegó a 10.699 casos y no se ha detenido.',
  'Bundibugyo virus, another ebolavirus species: no licensed vaccine or specific treatment. In Ituri, conflict and highly mobile populations hamper contact tracing. 10,699 confirmed cases and 5,202 deaths by 3 November, and still ongoing.': 'Virus Bundibugyo, otra especie de ébola: sin vacuna autorizada ni tratamiento específico. En Ituri, el conflicto y una población muy móvil dificultan el rastreo de contactos. 10.699 casos confirmados y 5.202 muertes hasta el 3 de noviembre, y sigue activo.',
  'Declared': 'Declarado',
  'Last patient discharged': 'Alta del último paciente',
  'Over': 'Fin del brote',
  'WHO · Disease Outbreak News, Ebola, DRC (DON580, DON589)': 'OMS · Partes de brotes, ébola, R. D. del Congo (DON580, DON589)',
  'Kasai 2025: 53 confirmed and 11 probable cases, with 45 deaths. Daily epidemic curve by symptom onset (Figure 2), as of 30 Nov 2025.': 'Kasai 2025: 53 casos confirmados, 11 probables y 45 muertes. Curva epidémica diaria por fecha de inicio de síntomas (figura 2), a 30 de noviembre de 2025.',
  'WHO AFRO · End of the 16th Ebola outbreak': 'OMS África · Fin del 16.º brote de ébola',
  '47,577 people were vaccinated, and the outbreak was declared over on 1 Dec 2025.': 'Se vacunó a 47.577 personas y el brote se dio por terminado el 1 de diciembre de 2025.',
  'WHO · Disease Outbreak News, Bundibugyo virus (DON602–DON625)': 'OMS · Partes de brotes, virus Bundibugyo (DON602–DON625)',
  'Bundibugyo 2026: confirmed cases by country as of 3 Nov 2026 (DRC: 10,668 confirmed cases and 5,198 deaths).': 'Bundibugyo 2026: casos confirmados por país a 3 de noviembre de 2026 (R. D. del Congo: 10.668 casos confirmados y 5.198 muertes).',
  "For Kasai 2025, daily cases (confirmed and probable) were read from the WHO epidemic curve by date of symptom onset; the extracted totals match WHO's 53 + 11.": 'En Kasai 2025, los casos diarios (confirmados y probables) se extrajeron de la curva epidémica de la OMS por fecha de inicio de síntomas, y los totales coinciden con los 53 + 11 oficiales.',
  "For Bundibugyo 2026, confirmed cases are plotted by date of report rather than onset. Between two WHO reports, new cases are distributed at a steady pace so that each report's cumulative total is matched exactly.": 'En Bundibugyo 2026, los casos confirmados se muestran por fecha de notificación y no de inicio de síntomas. Entre dos partes de la OMS, los casos nuevos se reparten a ritmo constante para que el total acumulado de cada parte coincida exactamente.',
  'Before 10 June, WHO counted only suspected cases in Bundibugyo 2026; the 676 cases confirmed by that date are distributed along a rising ramp starting from the first known onset on 24 April.': 'Antes del 10 de junio, la OMS solo registraba casos sospechosos en Bundibugyo 2026; los 676 casos confirmados hasta esa fecha se reparten en una rampa ascendente desde el primer inicio de síntomas conocido, el 24 de abril.',
  "The jump in the second half of July reflects WHO's data reconciliation on 22 July, not only newly diagnosed cases.": 'El salto de la segunda quincena de julio incluye la revisión de datos que publicó la OMS el 22 de julio, no solo casos nuevos.',
  'Both outbreaks start on day 0 (the first known case) and share the same speed, time axis and vertical scale. Kasai remains on the axis as an outline while Bundibugyo plays.': 'Ambos brotes empiezan en el día 0 (el primer caso conocido) y comparten velocidad, eje temporal y escala vertical. Kasai permanece en el eje como contorno mientras cae Bundibugyo.',
  'Deaths match the reported totals (45 and 5,202), but which specific cases died—and on which day—is assigned at random, since the data does not specify it.': 'Las muertes coinciden con los totales notificados (45 y 5.202), pero qué casos concretos murieron y en qué día se asigna al azar, ya que los datos no lo especifican.',
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
