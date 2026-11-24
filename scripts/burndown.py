"""Burndown charts for Sprint 1 and Sprint 2, built from the repository's real data.

    python scripts/burndown.py            # writes docs/evidence/burndown/

Story points come from each issue's "SP n" label and the sprint from its milestone. The time each
point was burned is the moment GitHub recorded the issue as closed. The sprint start is the first
commit pushed to main on the sprint day (both sprints ran on 19 November 2026; see SPRINT_LOG.md and
DEVIATIONS.md). Nothing is estimated or smoothed: every step in the chart is one issue closing.

Uses the public GitHub REST API (no token needed for this public repository), git, and matplotlib.
"""
import csv
import datetime as dt
import json
import os
import re
import subprocess
import urllib.request

import matplotlib

matplotlib.use('Agg')
import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.ticker import MaxNLocator  # noqa: E402

REPO = 'ThouSyntaxTerror/SE_MiniProject_Railway_Reservation'
OUT = os.path.join('docs', 'evidence', 'burndown')
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
SPRINT_DAY_START = dt.datetime(2026, 11, 19, tzinfo=IST)

# Reference palette (light): one data series, a recessive reference line, text tokens.
SERIES = '#2a78d6'
REFERENCE = '#8a8984'
TEXT = '#0b0b0b'
TEXT_2 = '#52514e'
GRID = '#e6e5e1'
SURFACE = '#fcfcfb'


def fetch_issues():
    url = f'https://api.github.com/repos/{REPO}/issues?state=all&per_page=100'
    req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json',
                                               'User-Agent': 'rrs-burndown-script'})
    with urllib.request.urlopen(req, timeout=30) as res:
        items = json.load(res)
    issues = []
    for it in items:
        if 'pull_request' in it or not it.get('milestone'):
            continue
        points = next((int(m.group(1)) for lab in it['labels']
                       if (m := re.fullmatch(r'SP (\d+)', lab['name']))), None)
        if points is None or not it.get('closed_at'):
            continue
        issues.append({
            'number': it['number'],
            'title': it['title'],
            'sprint': it['milestone']['title'],
            'points': points,
            'assignee': ','.join(a['login'] for a in it['assignees']),
            'closed': dt.datetime.fromisoformat(it['closed_at'].replace('Z', '+00:00')).astimezone(IST),
        })
    return issues


def sprint_start():
    """First commit on main on the sprint day."""
    since = SPRINT_DAY_START.isoformat()
    until = (SPRINT_DAY_START + dt.timedelta(days=1)).isoformat()
    out = subprocess.run(['git', 'log', '--reverse', '--format=%cI', f'--since={since}',
                          f'--until={until}', 'origin/main'],
                         capture_output=True, text=True, check=True).stdout.split()
    return dt.datetime.fromisoformat(out[0]).astimezone(IST)


def series(issues, start):
    total = sum(i['points'] for i in issues)
    xs, ys = [start], [total]
    remaining = total
    for i in sorted(issues, key=lambda i: i['closed']):
        xs.append(i['closed'])
        ys.append(remaining)  # horizontal run up to the closure ...
        remaining -= i['points']
        xs.append(i['closed'])
        ys.append(remaining)  # ... then the drop
    return total, xs, ys


def draw(ax, name, issues, start):
    total, xs, ys = series(issues, start)
    end = max(i['closed'] for i in issues)
    ax.set_facecolor(SURFACE)
    ax.plot([start, end], [total, 0], color=REFERENCE, linewidth=1.2, linestyle=(0, (4, 3)))
    ax.plot(xs, ys, color=SERIES, linewidth=2, solid_joinstyle='round')
    ax.plot(xs[-1], ys[-1], marker='o', markersize=6, color=SERIES,
            markeredgecolor=SURFACE, markeredgewidth=2)
    ax.annotate('ideal', xy=(start + (end - start) * 0.18, total * 0.82), color=TEXT_2, fontsize=9)
    ax.annotate(f'0 of {total} left\n{end:%H:%M}', xy=(end, 0), xytext=(-6, 10),
                textcoords='offset points', ha='right', color=TEXT, fontsize=9)
    ax.set_title(f'{name}: {total} points, {len(issues)} issues', loc='left', color=TEXT,
                 fontsize=11, fontweight='bold')
    ax.set_ylabel('Story points remaining', color=TEXT_2, fontsize=9)
    ax.set_ylim(0, total * 1.08)
    ax.yaxis.set_major_locator(MaxNLocator(integer=True))
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M', tz=IST))
    ax.tick_params(colors=TEXT_2, labelsize=8)
    ax.grid(axis='y', color=GRID, linewidth=0.8)
    for side in ('top', 'right'):
        ax.spines[side].set_visible(False)
    for side in ('left', 'bottom'):
        ax.spines[side].set_color(GRID)
    ax.set_xlabel('19 November 2026, IST', color=TEXT_2, fontsize=9)


def main():
    os.makedirs(OUT, exist_ok=True)
    issues = fetch_issues()
    start = sprint_start()
    sprints = sorted({i['sprint'] for i in issues})
    fig, axes = plt.subplots(1, len(sprints), figsize=(11, 4), dpi=150, facecolor=SURFACE)
    for ax, name in zip(axes, sprints):
        draw(ax, name, [i for i in issues if i['sprint'] == name], start)
    fig.suptitle('Sprint burndown from GitHub issue closures (both sprints ran on 19 Nov 2026)',
                 x=0.01, ha='left', color=TEXT_2, fontsize=9)
    fig.tight_layout()
    fig.savefig(os.path.join(OUT, 'burndown.png'), facecolor=SURFACE)

    with open(os.path.join(OUT, 'closures.csv'), 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh)
        w.writerow(['sprint', 'issue', 'title', 'points', 'assignee', 'closed_ist'])
        for i in sorted(issues, key=lambda i: (i['sprint'], i['closed'])):
            w.writerow([i['sprint'], f"#{i['number']}", i['title'], i['points'], i['assignee'],
                        i['closed'].strftime('%Y-%m-%d %H:%M:%S')])
    print(f'sprint start {start:%Y-%m-%d %H:%M} IST')
    for name in sprints:
        s = [i for i in issues if i['sprint'] == name]
        print(name, sum(i['points'] for i in s), 'points,', len(s), 'issues, last closed',
              max(i['closed'] for i in s).strftime('%H:%M'))


if __name__ == '__main__':
    main()
