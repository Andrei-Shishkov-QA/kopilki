"""Проверка экранов в браузере без интернета и без входа (Firebase подменяется tests/fake-firebase.js).
Нужно: python3, playwright (pip install playwright; playwright install chromium).
Запуск из корня репозитория:  python3 tests/preview.py start money "backup:document.querySelector('...').click()"
Каждый аргумент — '#экран' или '#экран:JS-код'. Скриншоты — в /tmp/preview-N.png, ошибки страницы — в выводе."""
import sys, json, asyncio, subprocess, time, os
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get('CHROME')  # путь к Chrome, если playwright-chromium не установлен

def sample():
    L = []; n = [0]
    def ev(t, at, **d):
        n[0] += 1; e = {'id': f'{t}-{n[0]}', 'seq': n[0], 'type': t, 'at': at, 'by': 'papa'}; e.update(d); L.append(e)
    ev('setup', '2026-11-01T10:00:00+04:00', balances={'bank': 2000, 'goals': 450, 'others': 60, 'wallet': 300},
       habits=[{'id': 'meal', 'name': 'Ритуал после еды', 'dailyMax': 7, 'status': 'active', 'mode': 'times', 'price': 1}])
    ev('habit', '2026-11-01T10:01:00+04:00', habit={'id': 'tapki', 'name': 'Тапки', 'status': 'active', 'mode': 'day', 'dayPrice': 2, 'suns': 5, 'dailyMax': 2})
    for d in range(2, 26):
        for k in range(3): ev('chip', f'2026-11-{d:02d}T1{k}:00:00+04:00', habitId='meal')
    ev('note', '2026-11-12T10:00:00+04:00', text='Обсудить новую цель')
    return L

async def main(shots):
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8790', '-d', ROOT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    fake = open(os.path.join(ROOT, 'tests', 'fake-firebase.js')).read()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}), args=['--no-sandbox'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block')  # sw.js не мешает подмене Firebase
            pg = await ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append('PAGE: ' + str(e)))
            await pg.route('**/vendor/firebase.js', lambda r: r.fulfill(body=fake, content_type='text/javascript'))
            await pg.goto('http://localhost:8790/index.html')
            await pg.evaluate("(e)=>{localStorage.setItem('fake.events',JSON.stringify(e));localStorage.setItem('kidbank.user','papa');}", sample())
            await pg.reload(); await pg.wait_for_timeout(600)
            for i, sh in enumerate(shots):
                route, _, js = sh.partition(':')
                await pg.evaluate(f"location.hash='{route}'"); await pg.wait_for_timeout(250)
                if js: await pg.evaluate(js); await pg.wait_for_timeout(350)
                await pg.screenshot(path=f'/tmp/preview-{i}.png')
                await pg.evaluate("document.querySelectorAll('.sheet-back').forEach(x=>x.remove());document.body.classList.remove('locked');document.body.style.top=''")
            print('ОШИБКИ:', errs or 'нет')
            await b.close()
    finally:
        srv.kill()

if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:] or ['start']))
