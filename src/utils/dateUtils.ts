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
  let s = String(str);
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
): { month: number; year: number; dateStr: string; timeStr?: string; day?: number } => {
  const now = new Date();
  let month = now.getMonth() + 1;
  let year = now.getFullYear();
  let day: number | undefined = undefined;
  let dateStr = '';
  let timeStr = '';

  let rawDate = '';
  if (memo) {
    if (typeof memo === 'string') {
      rawDate = memo;
    } else {
      timeStr = memo.createdAtTime || memo.timeStr || memo.memoState?.createdAtTime || '';
      const inner = memo.memoState || memo;

      // Always prioritize customDate if original date was toggled off or customDate is specified
      if (inner.isOriginalDate === false && inner.customDate) {
        rawDate = String(inner.customDate).trim();
      } else if (memo.isOriginalDate === false && memo.customDate) {
        rawDate = String(memo.customDate).trim();
      } else if (inner.customDate && inner.customDate !== inner.createdAt) {
        rawDate = String(inner.customDate).trim();
      } else if (memo.customDate && memo.customDate !== memo.createdAt) {
        rawDate = String(memo.customDate).trim();
      } else {
        rawDate = String(
          inner.customDate ||
          inner.createdAt ||
          inner.date ||
          memo.customDate ||
          memo.createdAt ||
          memo.date ||
          memo.dateStr ||
          ''
        ).trim();
      }
    }
  }

  if (rawDate) {
    dateStr = rawDate;
    const converted = bnToEnDigits(rawDate).toLowerCase().trim();

    // 1. Check Bengali and English month keywords
    const monthPatterns: [RegExp, number][] = [
      [/জানু|জানুয়ারি|জানুয়ারি|jan/i, 1],
      [/ফেব|ফেব্রুয়ারি|ফেব্রুয়ারি|feb/i, 2],
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
      if (regex.test(rawDate) || regex.test(converted)) {
        month = mIdx;
        foundKeyword = true;
        break;
      }
    }

    if (foundKeyword) {
      // Extract numbers to identify day and year
      const nums = (converted.match(/\d+/g) || []).map(Number);
      if (nums.length === 1) {
        if (nums[0] >= 2000 && nums[0] <= 2099) year = nums[0];
        else if (nums[0] >= 1 && nums[0] <= 31) day = nums[0];
        else if (nums[0] > 31 && nums[0] < 100) year = 2000 + nums[0];
      } else if (nums.length >= 2) {
        const y4 = nums.find(n => n >= 2000 && n <= 2099);
        if (y4) {
          year = y4;
          const d = nums.find(n => n !== y4 && n >= 1 && n <= 31);
          if (d) day = d;
        } else {
          // If two numbers e.g. 14, 26
          if (nums[0] >= 1 && nums[0] <= 31) {
            day = nums[0];
            year = nums[1] < 100 ? 2000 + nums[1] : nums[1];
          } else {
            day = nums[1] >= 1 && nums[1] <= 31 ? nums[1] : undefined;
            year = nums[0] < 100 ? 2000 + nums[0] : nums[0];
          }
        }
      }
    } else {
      // 2. Check 3-part date: DD-MM-YY, DD-MM-YYYY, DD/MM/YY, DD.MM.YY, YYYY-MM-DD
      const parts3 = converted.match(/(?:^|[^\d])(\d{1,4})[\/\-\.\s](\d{1,2})[\/\-\.\s](\d{2,4})(?:[^\d]|$)/);
      if (parts3) {
        const p1 = parseInt(parts3[1], 10);
        const p2 = parseInt(parts3[2], 10);
        const p3 = parseInt(parts3[3], 10);

        if (p1 >= 2000) {
          // YYYY-MM-DD
          year = p1;
          if (p2 >= 1 && p2 <= 12) month = p2;
          if (p3 >= 1 && p3 <= 31) day = p3;
        } else {
          // DD-MM-YY or DD-MM-YYYY
          if (p2 > 12 && p1 <= 12) {
            month = p1;
            day = p2;
          } else {
            day = p1;
            if (p2 >= 1 && p2 <= 12) month = p2;
          }
          year = p3 < 100 ? 2000 + p3 : p3;
        }
      } else {
        // 3. Check 2-part date: MM-YYYY, MM/YYYY, MM-YY, MM/YY
        const parts2 = converted.match(/(?:^|[^\d])(\d{1,2})[\/\-\.\s](\d{2,4})(?:[^\d]|$)/);
        if (parts2) {
          const p1 = parseInt(parts2[1], 10);
          const p2 = parseInt(parts2[2], 10);
          if (p1 >= 1 && p1 <= 12) {
            month = p1;
            year = p2 < 100 ? 2000 + p2 : p2;
          }
        }
      }
    }
  } else if (timestamp && timestamp > 0) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      year = d.getFullYear();
      day = d.getDate();
    }
  } else if (memo?.id && !isNaN(Number(memo.id)) && Number(memo.id) > 1000000000) {
    const d = new Date(Number(memo.id));
    if (!isNaN(d.getTime())) {
      month = d.getMonth() + 1;
      year = d.getFullYear();
      day = d.getDate();
    }
  }

  return { month, year, dateStr, timeStr, day };
};
