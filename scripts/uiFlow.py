"""UI half of the system test: drives the real React app in headless Chrome (register, sign in,
search, book, cancel) and saves a screenshot at each step.

    python scripts/uiFlow.py docs/evidence/system-test

Needs the API on :3000 and the Vite dev server on :5173 (npm start / npm run dev), the seeded
timetable (npm run migrate, trip 12627 Bengaluru -> Chennai) and `pip install selenium`.
It registers a throw-away passenger each run. Exit code 0 means the whole flow passed.
"""
import os, sys, time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
BASE = 'http://localhost:5173'
email = f'ui-{int(time.time())}@example.com'; pw = 'UiFlowPassword123'
o = webdriver.ChromeOptions(); o.add_argument('--headless=new'); o.add_argument('--window-size=1280,1000')
d = webdriver.Chrome(options=o); w = WebDriverWait(d, 15)
shot = lambda n: d.save_screenshot(os.path.join(OUT, n))
log = []
def step(msg): log.append(msg); print(msg)

d.get(BASE + '/register')
d.find_element(By.ID, 'name').send_keys('UI Flow Passenger')
d.find_element(By.ID, 'email').send_keys(email)
d.find_element(By.ID, 'password').send_keys(pw)
d.find_element(By.CSS_SELECTOR, 'form button[type=submit]').click()
w.until(EC.url_contains('/login'))
d.find_element(By.ID, 'email').send_keys(email); d.find_element(By.ID, 'password').send_keys(pw)
d.find_element(By.CSS_SELECTOR, 'form button[type=submit]').click()
w.until(EC.url_contains('/search')); step('1 signed in, on /search')

d.find_element(By.ID, 'origin').send_keys('Bengaluru'); d.find_element(By.ID, 'destination').send_keys('Chennai')
d.find_element(By.CSS_SELECTOR, 'form[role=search] button[type=submit]').click()
btn = w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'button[aria-label^="Book train 12627"]')))
time.sleep(1.2); shot('1-search-results.png'); step('2 search results shown for Bengaluru to Chennai')
btn.click()
banner = w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.success[role=status]')))
pnr_text = banner.text; step('3 booking banner: ' + pnr_text.replace('\n', ' '))
time.sleep(0.8); shot('2-booked-banner.png')

d.get(BASE + '/my-bookings')
cancel = w.until(EC.element_to_be_clickable((By.CSS_SELECTOR, 'button.btn-danger')))
pnr = cancel.get_attribute('aria-label').replace('Cancel booking ', '')
time.sleep(0.8); shot('3-my-bookings-confirmed.png'); step(f'4 My bookings shows {pnr} confirmed')
cancel.click()
notice = w.until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.success[role=status]')))
step('5 cancel notice: ' + notice.text.replace('\n', ' '))
time.sleep(0.8); shot('4-cancelled-refund.png')
badge = d.find_element(By.CSS_SELECTOR, '.badge').text
step('6 status badge now: ' + badge)
ok = ('RFND-' + pnr) in notice.text and badge.lower() == 'cancelled'
step('RESULT ' + ('PASS' if ok else 'FAIL') + f': refund reference RFND-{pnr} shown and status {badge}')
open(os.path.join(OUT, 'ui-flow-log.txt'), 'w', encoding='utf-8').write('\n'.join(log) + '\n')
d.quit(); sys.exit(0 if ok else 1)
