import os
import re

filepath = "C:/Users/zqiu/Desktop/AI Playground/world_time_buddy/app.js"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    "this.datePicker = document.getElementById('date-picker');",
    "this.datePickerLabel = document.getElementById('date-picker-label');"
)

replacement = "if (this.datePickerLabel) { const parts = this.parseDateString(this.currentDate); this.datePickerLabel.textContent = `${String(parts.d).padStart(2, '0')} . ${String(parts.mo).padStart(2, '0')} . ${parts.y}`; }"
content = content.replace(
    "this.datePicker.value = this.currentDate;",
    replacement
)

replacement2 = "if (this.datePickerLabel) { const parts = this.parseDateString(dateStr); this.datePickerLabel.textContent = `${String(parts.d).padStart(2, '0')} . ${String(parts.mo).padStart(2, '0')} . ${parts.y}`; }"
content = content.replace(
    "if (this.datePicker) this.datePicker.value = dateStr;",
    replacement2
)

replacement3 = "if (this.datePickerLabel) { const parts = this.parseDateString(nextDate); this.datePickerLabel.textContent = `${String(parts.d).padStart(2, '0')} . ${String(parts.mo).padStart(2, '0')} . ${parts.y}`; }"
content = content.replace(
    "if (this.datePicker) this.datePicker.value = nextDate;",
    replacement3
)

content = content.replace(
    "const anchor = this.weekCalBtn || this.datePicker;",
    "const anchor = this.weekCalBtn;"
)

content = content.replace(
    "if (this.datePicker) this.datePicker.focus();",
    "if (this.weekCalBtn) this.weekCalBtn.focus();"
)

buggy_listener = '''    // Dismiss when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isWeekCalendarOpen) return;
      const pop = this.weekCalendarPopover;
      const btn = this.weekCalBtn;
      const topWk = document.getElementById('top-clock-week');
      if (pop && !pop.contains(e.target) && (!btn || !btn.contains(e.target)) && (!topWk || !topWk.contains(e.target))) {
        this.closeWeekCalendar(false);
      }
    });'''

fixed_listener = '''    // Dismiss when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isWeekCalendarOpen) return;
      if (!document.body.contains(e.target)) return;
      const pop = this.weekCalendarPopover;
      const btn = this.weekCalBtn;
      const topWk = document.getElementById('top-clock-week');
      if (pop && !pop.contains(e.target) && (!btn || !btn.contains(e.target)) && (!topWk || !topWk.contains(e.target))) {
        this.closeWeekCalendar(false);
      }
    });'''

content = content.replace(buggy_listener, fixed_listener)

content = re.sub(r"this\.datePicker\.addEventListener\('change', \(e\) => \{.*?\n\s*\}\);", "", content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
