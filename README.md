# BUILDMATIC OS V11

تطبيق سوق مهارات مبني بـVite وReact وSupabase.

## المتطلبات

- Node.js 20 أو أحدث
- مشروع Supabase

## إعداد Supabase

1. أنشئ مشروعاً في Supabase.
2. افتح SQL Editor وشغّل `schema.sql` بالكامل.
3. فعّل Email provider في Authentication.
4. ضف عنوان النشر إلى Authentication → URL Configuration.

## التشغيل المحلي

```bash
cp .env.example .env
npm install
npm run dev
```

ضع في `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_TURNSTILE_SITE_KEY=
```

لا تضع service role key أو أي مفتاح سري في ملفات المتصفح.

## البناء والنشر

```bash
npm run build
npm run preview
```

ارفع مجلد `dist` إلى Vercel أو Netlify أو Cloudflare Pages، وحدد متغيرات البيئة في لوحة النشر.

## نموذج البيانات والصلاحيات

- `profiles` و`user_state` و`xp_events` و`agent_usage` بيانات خاصة ولا يستطيع المستخدم قراءة أو تعديل صفوف مستخدم آخر.
- `marketplace_skills` سوق مشترك قابِل للقراءة لجميع المستخدمين المسجلين، ولا يقدر المستخدم تعديل إلا المحتوى الذي أنشأه.
- `dev_news` أخبار مشتركة للقراءة، ويمكن للمستخدمين المصرح لهم النشر بها.
- `elite_messages` محادثة جماعية؛ جميع المستخدمين المؤهلين وفق XP يقرؤونها ويرسلون فيها، ولا يقرأها غير المؤهلين أو الضيوف.

## الاختبار

1. أنشئ حسابين مختلفين بتأكيد البريد إن كان مطلوباً.
2. سجّل الدخول بالحساب الأول وأنشئ مهارة أو ملفاً واحفظه.
3. أعد تحميل الصفحة وتأكد من ظهور الملف وحفظه.
4. سجّل الدخول بالحساب الثاني وتأكد أنه لا يرى `user_state` أو الملف الشخصي للحساب الأول.
5. أنشئ خبراً أو مهارة سوقية وتأكد أن الحسابين يشاهدانها.
6. ارفع XP لحساب عبر دالة `award_xp` فقط، ولاحظ أن تحديث XP المباشر محظور.
7. جرّب التعديل المباشر أو القراءة عبر DevTools لحساب آخر؛ يجب ألا تعيد Supabase البيانات أو تسمح بالتعديل.
