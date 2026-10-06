import { MatchStatus, SportCategory } from './types';

export interface MatchScheduleInfo {
  badgeText: string;
  dateText: string;
  timeText: string;
  fullText: string;
  detailText: string;
  isToday: boolean;
  isTomorrow: boolean;
  isYesterday: boolean;
}

export function formatMatchSchedule(
  isoString?: string | null,
  status?: MatchStatus,
  fallbackTime?: string
): MatchScheduleInfo {
  if (!isoString) {
    if (status === 'LIVE') {
      return {
        badgeText: 'EN DIRECTO',
        dateText: 'Hoy',
        timeText: fallbackTime || 'En juego',
        fullText: fallbackTime ? `En directo • ${fallbackTime}` : 'En directo',
        detailText: 'Partido en curso',
        isToday: true,
        isTomorrow: false,
        isYesterday: false,
      };
    }
    if (status === 'FINISHED') {
      return {
        badgeText: 'FINAL',
        dateText: 'Reciente',
        timeText: 'Finalizado',
        fullText: 'Partido Finalizado',
        detailText: 'Resultado final registrado',
        isToday: false,
        isTomorrow: false,
        isYesterday: false,
      };
    }
    return {
      badgeText: fallbackTime || 'PROGRAMADO',
      dateText: 'Próximamente',
      timeText: fallbackTime || 'Hora por definir',
      fullText: fallbackTime ? `Próximo • ${fallbackTime}` : 'Horario por confirmar',
      detailText: 'Horario por confirmar',
      isToday: false,
      isTomorrow: false,
      isYesterday: false,
    };
  }

  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    return {
      badgeText: status === 'LIVE' ? 'EN DIRECTO' : status === 'FINISHED' ? 'FINAL' : 'PROGRAMADO',
      dateText: '',
      timeText: fallbackTime || '',
      fullText: fallbackTime || '',
      detailText: '',
      isToday: false,
      isTomorrow: false,
      isYesterday: false,
    };
  }

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();

  const tom = new Date(now);
  tom.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tom.toDateString();

  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const timeText = `${hh}:${mm}h`;

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const fullDaysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const fullMonths = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  const dayName = daysOfWeek[d.getDay()];
  const fullDayName = fullDaysOfWeek[d.getDay()];
  const monthName = months[d.getMonth()];
  const fullMonthName = fullMonths[d.getMonth()];
  const dayNum = d.getDate();
  const year = d.getFullYear();

  let dateText = `${dayName} ${dayNum} ${monthName}`;
  if (isToday) dateText = 'Hoy';
  else if (isYesterday) dateText = 'Ayer';
  else if (isTomorrow) dateText = 'Mañana';

  const detailText = `${fullDayName}, ${dayNum} de ${fullMonthName} de ${year} a las ${timeText}`;

  if (status === 'LIVE') {
    return {
      badgeText: 'EN DIRECTO',
      dateText,
      timeText,
      fullText: fallbackTime ? `En directo • ${fallbackTime}` : 'En directo',
      detailText: `Partido en directo • Empezó ${dateText.toLowerCase()} a las ${timeText}`,
      isToday,
      isTomorrow,
      isYesterday,
    };
  }

  if (status === 'FINISHED') {
    return {
      badgeText: 'FINAL',
      dateText,
      timeText,
      fullText: `${dateText} • ${timeText}`,
      detailText: `Finalizado • Jugado ${dateText.toLowerCase()} a las ${timeText}`,
      isToday,
      isTomorrow,
      isYesterday,
    };
  }

  // UPCOMING
  return {
    badgeText: isToday ? `Hoy ${timeText}` : isTomorrow ? `Mañana ${timeText}` : `${dayName} ${dayNum} • ${timeText}`,
    dateText,
    timeText,
    fullText: `${dateText} a las ${timeText}`,
    detailText: `Programado para el ${detailText}`,
    isToday,
    isTomorrow,
    isYesterday,
  };
}

export function getSportLabelWithEmoji(sport: SportCategory | 'TODOS'): string {
  switch (sport) {
    case 'FÚTBOL':
      return 'Fútbol';
    case 'VALORANT':
      return 'Valorant';
    case 'LOL':
      return 'LoL';
    case 'CS2':
      return 'CS2';
    case 'R6':
      return 'R6 Siege';
    case 'DOTA2':
      return 'Dota 2';
    default:
      return 'Todos';
  }
}
