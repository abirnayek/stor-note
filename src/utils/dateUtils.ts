export interface MonthDef {
  index: number;
  nameBn: string;
  nameEn: string;
  shortBn: string;
  shortEn: string;
}

export const MONTHS: MonthDef[] = [
  { index: 1, nameBn: 'জানুয়ারি', nameEn: 'January', shortBn: 'জানু', shortEn: 'Jan' },
  { index: 2, nameBn: 'ফেব্রুয়ারি', nameEn: 'February', shortBn: 'ফেব', shortEn: 'Feb' },
  { index: 3, nameBn: 'মার্চ', nameEn: 'March', shortBn: 'মার্চ', shortEn: 'Mar' },
  { index: 4, nameBn: 'এপ্রিল', nameEn: 'April', shortBn: 'এপ্রি', shortEn: 'Apr' },
  { index: 5, nameBn: 'মে', nameEn: 'May', shortBn: 'মে', shortEn: 'May' },
  { index: 6, nameBn: 'জুন', nameEn: 'June', shortBn: 'জুন', shortEn: 'Jun' },
  { index: 7, nameBn: 'জুলাই', nameEn: 'July', shortBn: 'জুল', shortEn: 'Jul' },
  { index: 8, nameBn: 'আগস্ট', nameEn: 'August', shortBn: 'আগ', shortEn: 'Aug' },
  { index: 9, nameBn: 'সেপ্টেম্বর', nameEn: 'September', shortBn: 'সেপ্টে', shortEn: 'Sep' },
  { index: 10, nameBn: 'অক্টোবর', nameEn: 'October', shortBn: 'অক্টো', shortEn: 'Oct' },
  { index: 11, nameBn: 'নভেম্বর', nameEn: 'November', shortBn: 'নভে', shortEn: 'Nov' },
  { index: 12, nameBn: 'ডিসেম্বর', nameEn: 'December', shortBn: 'ডিসে', shortEn: 'Dec' },
];

export const bnToEnDigits = (str: string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  let s = str;
  bnDigits.forEach((d, i) => {
    s = s.split(d).join(i.toString());
  });
  return s;
};

export const enToBnDigits = (num: number | string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, d => bnDigits[Number(d)]);
};

export const parseMemoMonthYear = (
  memo: any,
  timestamp?: number
): { month: number; year: number; dateStr: string; timeStr?: string } => {
  const now = new Date();
  let month = now.getMonth() + 1;
  let year = now.getFullYear();
  let dateStr = '';
  let timeStr = memo?.createdAtTime || '';

  const rawDate = memo?.createdAt || memo?.date || '';
  if (rawDate) {
    dateStr = String(rawDate);
    const converted = bnToEnDigits(dateStr).toLowerCase();

    // Check month keywords in Bengali and English
    const monthPatterns: [RegExp, number][] = [
      [/জানু|জানুয়ারি|jan/i, 1],
      [/ফেব|ফেব্রুয়ারি|feb/i, 2],
      [/মার্চ|mar/i, 3],
      [/এপ্রি|এপ্রিল|apr/i, 4],
      [/মে|may/i, 5],
      [/জুন|jun/i, 6],
      [/জুল|জুলাই|jul/i, 7],
      [/আগ|আগস্ট|aug/i, 8],
      [/সেপ্টে|সেপ্টেম্বর|sep/i, 9],
      [/অক্টো|অক্টোবর|oct/i, 10],
      [/নভে|নভেম্বর|nov/i, 11],
      [/ডিসে|ডিসেম্বর|dec/i, 12],
    ];

    let foundKeyword = false;
    for (const [regex, mIdx] of monthPatterns) {
      if (regex.test(dateStr) || regex.test(converted)) {
        month = mIdx;
        foundKeyword = true;
        break;
      }
    }

    if (!foundKeyword) {
      // Check numeric format like DD/MM/YYYY or YYYY-MM-DD
      const slashMatch = converted.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (slashMatch) {
        const p2 = parseInt(slashMatch[2], 10);
        const p3 = parseInt(slashMatch[3], 10);
        if (p3 >= 2000) {
          year = p3;
          if (p2 >= 1 && p2 <= 12) month = p2;
        }
      }
    }

    // Extract 4 digit year
    const yearMatch = converted.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }
  } else if (timestamp && timestamp > 0) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }
  } else if (memo?.id && !isNaN(Number(memo.id)) && Number(memo.id) > 1000000000) {
    const d = new Date(Number(memo.id));
    if (!isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      year = d.getFullYear();
    }
  }

  return { month, year, dateStr, timeStr };
};
