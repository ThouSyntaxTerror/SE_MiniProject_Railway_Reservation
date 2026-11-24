"""Keyboard-only and viewport check of the ADMINISTRATOR pages (NFR-05, NFR-06).

The passenger pages were covered by the earlier matrix (docs/evidence/nfr05-nfr06/). This does the
same for /admin: sign in as the seeded administrator, reach the Admin page and create a trip, edit
its capacity and disable it using the keyboard only, check that every control has an accessible name
that says which trip it acts on, and check there is no horizontal page scroll at 375 px and 1280 px.

    python scripts/adminMatrix.py chrome docs/evidence/admin-matrix      # or edge, firefox

Needs the API on :3000 and the UI on :5173 (npm start / npm run dev), the seeded administrator
(npm run migrate) and `pip install selenium`. Writes <browser>.json and screenshots to the out
directory. Exit code 0 means every step passed.
"""
import datetime
import json
import os
import sys
import time

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

BASE = os.environ.get('RRS_UI', 'http://localhost:5173')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@rrs.test')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'AdminPassword123')
browser = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
RUN = str(int(time.time()))[-6:]
TRAIN = f'AM{RUN}'

DESC_JS = """
const el = document.activeElement; if (!el) return null;
const cs = getComputedStyle(el);
let name = el.getAttribute('aria-label') || '';
if (!name && el.labels && el.labels.length) name = el.labels[0].innerText.trim();
if (!name) name = (el.innerText || el.value || '').trim().slice(0, 60);
const focusVisible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
return {tag: el.tagName.toLowerCase(), id: el.id || null, type: el.type || null, name, focusVisible};
"""

# Every interactive control on the page, with its accessible name as the browser computes it.
UNNAMED_JS = """
const out = [];
document.querySelectorAll('a[href], button, input, select, textarea').forEach((el) => {
  if (el.type === 'hidden') return;
  let name = el.getAttribute('aria-label') || '';
  if (!name && el.labels && el.labels.length) name = el.labels[0].innerText.trim();
  if (!name) name = (el.innerText || '').trim();
  if (!name) out.push(el.outerHTML.slice(0, 90));
});
return out;
"""

DUPLICATE_ACTIONS_JS = """
const names = {};
document.querySelectorAll('table button').forEach((b) => {
  const n = b.getAttribute('aria-label') || b.innerText.trim();
  names[n] = (names[n] || 0) + 1;
});
return Object.entries(names).filter(([, c]) => c > 1).map(([n, c]) => n + ' x' + c);
"""


def make_driver():
    if browser == 'chrome':
        o = webdriver.ChromeOptions()
        o.add_argument('--headless=new')
        return webdriver.Chrome(options=o)
    if browser == 'edge':
        o = webdriver.EdgeOptions()
        o.add_argument('--headless=new')
        return webdriver.Edge(options=o)
    o = webdriver.FirefoxOptions()
    o.add_argument('-headless')
    return webdriver.Firefox(options=o)


d = make_driver()
results = {'browser': browser, 'version': d.capabilities.get('browserVersion'), 'train': TRAIN,
           'keyboard': [], 'names': [], 'viewport': []}
actions = lambda: ActionChains(d)


def shot(name):
    d.save_screenshot(os.path.join(OUT, f'{browser}-{name}.png'))


def step(label, ok, detail=''):
    results['keyboard'].append({'step': label, 'ok': bool(ok), 'detail': detail})
    print(('PASS ' if ok else 'FAIL ') + label + (f'  [{detail}]' if detail else ''))


def tab_to(label, match, limit=60):
    stops = []
    for i in range(1, limit + 1):
        actions().send_keys(Keys.TAB).perform()
        info = d.execute_script(DESC_JS)
        stops.append(f"{info['tag']}:{info['name']}" if info else 'none')
        if info and match(info):
            step(label, True, f"{i} Tab(s) -> {info['tag']} '{info['name']}', focus visible: {info['focusVisible']}")
            results['keyboard'][-1]['focusVisible'] = info['focusVisible']
            return True
    step(label, False, 'not reached; stops: ' + ' | '.join(stops[-6:]))
    return False


def type_keys(s):
    actions().send_keys(s).perform()


def outcome(timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        r = d.execute_script(
            "const s=document.querySelector('[role=status]'); if(s) return ['status',s.innerText];"
            "const a=document.querySelector('[role=alert]'); return a?['alert',a.innerText]:null")
        if r:
            return r
        time.sleep(0.25)
    return (None, '')


def datetime_keys(when, order):
    """Key sequence for a datetime-local field, as a list of segment strings. `order` is 'mdy' or
    'dmy'. The year segment accepts up to six digits and so does not advance by itself; the caller
    presses the right-arrow key after it. The clock is 12 h or 24 h as the browser reports."""
    hour12 = d.execute_script(
        "return new Intl.DateTimeFormat(undefined,{hour:'numeric'}).resolvedOptions().hour12;")
    day, month, year = f'{when.day:02d}', f'{when.month:02d}', f'{when.year}'
    first, second = (month, day) if order == 'mdy' else (day, month)
    if hour12:
        h = when.hour % 12 or 12
        tail = [f'{h:02d}', f'{when.minute:02d}', 'PM' if when.hour >= 12 else 'AM']
    else:
        tail = [f'{when.hour:02d}', f'{when.minute:02d}']
    return [first, second, year] + tail


def type_segments(segments):
    for i, seg in enumerate(segments):
        type_keys(seg)
        # The year: Chrome and Edge accept up to six digits and wait, so move on explicitly; Firefox
        # stops at four digits and moves on by itself, where an extra key would skip a segment.
        if i == 2 and browser != 'firefox':
            type_keys(Keys.ARROW_RIGHT)


def fill_datetime(field_id, when):
    """Type a date and time into the focused datetime-local field using the keyboard only. Browsers
    disagree on the segment order, so if the value that results is wrong, go back to the first
    segment with Shift+Tab and type it again in the other order."""
    expected = when.strftime('%Y-%m-%dT%H:%M')
    guessed = d.execute_script(
        "return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'2-digit',day:'2-digit'})"
        ".formatToParts(new Date(2001,10,22)).filter(p=>p.type!=='literal').map(p=>p.type)[0];")
    orders = ['dmy', 'mdy'] if guessed == 'day' else ['mdy', 'dmy']
    for attempt, order in enumerate(orders):
        segments = datetime_keys(when, order)
        type_segments(segments)
        value = d.execute_script("return document.getElementById(arguments[0]).value", field_id)
        if value == expected:
            return value, order
        if attempt == 0:
            for _ in range(len(segments) - 1):
                actions().key_down(Keys.SHIFT).send_keys(Keys.TAB).key_up(Keys.SHIFT).perform()
    return value, order


def set_width(width):
    """True viewport width: load the page inside a same-origin iframe of that width (works in every
    browser; a headless window cannot be resized below about 500 px)."""
    d.get(BASE + '/search')
    d.execute_script(
        "document.body.innerHTML=''; document.body.style.margin='0';"
        "const f=document.createElement('iframe'); f.id='vp'; f.style.cssText='border:0;width:%dpx;height:900px';"
        "f.src='/admin'; document.body.appendChild(f);" % width)
    time.sleep(2.5)


success = False
try:
    d.set_window_size(1280, 1000)
    d.get(BASE + '/login')
    time.sleep(1)

    # ---- sign in as administrator with the keyboard -------------------------------------------
    tab_to('Tab to sign-in Email', lambda i: i['id'] == 'email')
    type_keys(ADMIN_EMAIL)
    tab_to('Tab to sign-in Password', lambda i: i['id'] == 'password')
    type_keys(ADMIN_PASSWORD + Keys.ENTER)
    time.sleep(1.5)
    step('Administrator signed in with Enter, lands on search', d.current_url.endswith('/search'), d.current_url)

    # ---- reach the Admin page through the navigation -----------------------------------------
    d.refresh()
    time.sleep(1)
    reached = tab_to('Tab to the Admin link in the navigation',
                     lambda i: i['tag'] == 'a' and i['name'].strip().lower() == 'admin')
    type_keys(Keys.ENTER)
    time.sleep(1.2)
    step('Enter on Admin opens the Administration page', d.current_url.endswith('/admin') and
         'Administration' in d.find_element('tag name', 'h1').text, d.current_url)
    shot('1-admin-page')

    # ---- accessible names ---------------------------------------------------------------------
    unnamed = d.execute_script(UNNAMED_JS)
    results['names'].append({'check': 'controls without an accessible name', 'found': unnamed})
    step('Every link, button and input on /admin has an accessible name', not unnamed, '; '.join(unnamed))
    dupes = d.execute_script(DUPLICATE_ACTIONS_JS)
    results['names'].append({'check': 'row buttons whose name repeats', 'found': dupes})
    step('Row buttons name the trip they act on (no repeated "Save" / "Disable")', not dupes, '; '.join(dupes))

    # ---- create a trip with the keyboard -------------------------------------------------------
    dep = (datetime.datetime.now() + datetime.timedelta(days=4)).replace(second=0, microsecond=0)
    arr = dep + datetime.timedelta(hours=5)
    tab_to('Tab to Train number', lambda i: i['id'] == 'train_number')
    type_keys(TRAIN)
    tab_to('Tab to Origin', lambda i: i['id'] == 'origin')
    type_keys('Bengaluru')
    tab_to('Tab to Destination', lambda i: i['id'] == 'destination')
    type_keys('Mysuru')
    tab_to('Tab to Departure', lambda i: i['id'] == 'departure')
    dep_value, dep_order = fill_datetime('departure', dep)
    tab_to('Tab to Arrival', lambda i: i['id'] == 'arrival')
    arr_value, arr_order = fill_datetime('arrival', arr)
    step('Departure and arrival typed with keys only',
         dep_value == dep.strftime('%Y-%m-%dT%H:%M') and arr_value == arr.strftime('%Y-%m-%dT%H:%M'),
         f'{dep_value} ({dep_order}) / {arr_value} ({arr_order})')
    tab_to('Tab to Fare', lambda i: i['id'] == 'fare')
    type_keys('555')
    tab_to('Tab to Seat capacity', lambda i: i['id'] == 'capacity')
    type_keys('6')
    tab_to('Tab to Create trip', lambda i: i['tag'] == 'button' and i['name'] == 'Create trip')
    shot('2-create-focus')
    type_keys(Keys.ENTER)
    kind, text = outcome()
    step('Create trip with Enter reports success', kind == 'status', f'{kind}: {text}')
    time.sleep(0.8)
    in_table = d.execute_script(
        "return Array.from(document.querySelectorAll('#trips-heading ~ div table tbody tr')).some(r=>r.innerText.includes(arguments[0]))", TRAIN)
    step('The new trip appears in the Trips table', in_table, TRAIN)

    # ---- edit capacity and disable it with the keyboard ----------------------------------------
    tab_to('Tab to the new trip\'s capacity field',
           lambda i: i['name'] == f'Capacity for {TRAIN}', limit=80)
    # Clear with End + Backspace (Ctrl+A behaves differently in Firefox number fields), then type 9.
    type_keys(Keys.END + Keys.BACKSPACE * 4 + '9')
    typed = d.execute_script("return document.activeElement.value")
    step('Capacity changed to 9 with the keyboard', typed == '9', repr(typed))
    tab_to('Tab to its Save button', lambda i: i['name'] == f'Save capacity for {TRAIN}')
    type_keys(Keys.ENTER)
    kind, text = outcome()
    time.sleep(0.8)
    step('Save capacity with Enter reports success', kind == 'status', f'{kind}: {text}')
    tab_to('Tab to its Disable button', lambda i: i['name'] == f'Disable trip {TRAIN}')
    shot('3-disable-focus')
    type_keys(Keys.ENTER)
    # Disabling asks for confirmation with the browser's own dialog, which is keyboard operable
    # (Enter confirms, Escape cancels); the driver's accept() is the equivalent of pressing Enter.
    time.sleep(0.5)
    try:
        asked = d.switch_to.alert.text
        d.switch_to.alert.accept()
    except Exception:  # noqa: BLE001 - no dialog appeared
        asked = None
    step('Disable asks for confirmation naming the trip', asked == f'Disable trip {TRAIN}?', repr(asked))
    kind, text = outcome()
    time.sleep(0.8)
    step('Confirming the disable reports success', kind == 'status', f'{kind}: {text}')
    disabled_now = d.execute_script(
        "const r=Array.from(document.querySelectorAll('#trips-heading ~ div table tbody tr')).find(r=>r.innerText.includes(arguments[0]));"
        "return r ? r.querySelector('button[aria-label^=\"Disable\"]').disabled : null", TRAIN)
    step('The trip is now disabled and its Disable button is inactive', disabled_now is True)
    shot('4-after-disable')

    # ---- no horizontal scroll at both widths ---------------------------------------------------
    for width in (1280, 375):
        set_width(width)
        metrics = d.execute_script(
            "const f=document.getElementById('vp'); const de=f.contentDocument.documentElement;"
            "return [de.scrollWidth, f.contentWindow.innerWidth];")
        ok = metrics[0] <= metrics[1]
        results['viewport'].append({'width': width, 'scrollWidth': metrics[0], 'innerWidth': metrics[1], 'ok': ok})
        step(f'/admin at {width} px has no horizontal page scroll', ok, f'scrollWidth {metrics[0]} / innerWidth {metrics[1]}')
        shot(f'5-admin-{width}px')

    success = all(s['ok'] for s in results['keyboard'])
finally:
    with open(os.path.join(OUT, f'{browser}.json'), 'w', encoding='utf-8') as fh:
        json.dump(results, fh, indent=2)
    d.quit()

passed = sum(1 for s in results['keyboard'] if s['ok'])
print(f"\n{browser} {results['version']}: {passed}/{len(results['keyboard'])} steps passed")
sys.exit(0 if success else 1)
