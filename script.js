// ตรวจสอบสถานะการล็อกอินก่อนทุกครั้ง
if (sessionStorage.getItem('isAuthenticated') !== 'true') {
    window.location.href = 'login.html';
}

class DinoBotWorkTracker {
    constructor() {
        this.STORAGE_KEYS = {
            RECORDS: 'dinoWorkRecordsV5',
            SETTINGS: 'dinoWorkSettingsV5',
            STATUS: 'dinoCurrentStatusV5',
            CHECK_IN_TIME: 'dinoCheckInTimeV5',
            TODAY_DATA: 'dinoTodayDataV5'
        };

        this.records = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.RECORDS)) || [];
        this.settings = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SETTINGS)) || this.getDefaultSettings();
        
        this.currentStatus = localStorage.getItem(this.STORAGE_KEYS.STATUS) || 'out';
        this.checkInTime = localStorage.getItem(this.STORAGE_KEYS.CHECK_IN_TIME) || null;
        this.selectedShift = null;
        this.isDoublePay = false;
        this.currentCalendarDate = new Date();
        this.workTimeInterval = null;

        this.initializeElements();
        this.updateAllDisplays();
        this.startClock();
    }

    getDefaultSettings() {
        return { rateMorning: 380, rateAfternoon: 380, rateNight: 380, ratePaidHoliday: 380 };
    }

    initializeElements() {
        // Main Actions
        document.querySelectorAll('.shift-btn').forEach(btn => btn.addEventListener('click', () => this.selectShift(btn.dataset.shift)));
        document.getElementById('doublePayToggle').addEventListener('change', (e) => this.isDoublePay = e.target.checked);
        document.getElementById('checkInBtn').addEventListener('click', () => this.checkIn());
        document.getElementById('checkOutBtn').addEventListener('click', () => this.checkOut());
        document.getElementById('paidDayOffBtn').addEventListener('click', () => this.logPaidDayOff());
        
        // Calendar & Data
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.handleClearDataRequest());

        // Modals
        document.querySelectorAll('.modal-close-btn').forEach(btn => btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal').id)));
        document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal').id)));
        
        // Settings Modal
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());

        // Edit Modal
        document.getElementById('saveEditBtn').addEventListener('click', () => this.saveEdit());

        // Record Action Menu
        document.body.addEventListener('click', (e) => {
            if (!document.getElementById('recordActionMenu').contains(e.target) && !e.target.closest('.action-menu-trigger')) {
                this.hideRecordActions();
            }
        });

        // Password Modal for Clearing Data
        document.getElementById('confirmClearDataBtn').addEventListener('click', () => this.confirmClearData());
        document.querySelectorAll('#passwordModal .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('passwordClearDataInput').value = ''; // Clear password on close
                this.closeModal('passwordModal');
            });
        });
    }

    handleClearDataRequest() {
        this.openModal('passwordModal');
    }

    confirmClearData() {
        const enteredPassword = document.getElementById('passwordClearDataInput').value;
        
        if (enteredPassword === '200543') {
            this.closeModal('passwordModal');
            document.getElementById('passwordClearDataInput').value = '';

            setTimeout(() => {
                if (confirm('⚠️ ยืนยันครั้งสุดท้าย! คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมดจริงๆ? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                    this.executeClearData();
                } else {
                    this.showToast('ℹ️ การล้างข้อมูลถูกยกเลิก', 'info');
                }
            }, 250);

        } else {
            this.showToast('❌ รหัสผ่านไม่ถูกต้อง!', 'error');
            document.getElementById('passwordClearDataInput').value = '';
        }
    }

    executeClearData() {
        Object.values(this.STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        this.showToast('🗑️ ล้างข้อมูลทั้งหมดแล้ว', 'info');
        setTimeout(() => location.reload(), 1500);
    }
    
    // --- MAIN ACTIONS ---
    selectShift(shiftName) {
        if (this.currentStatus === 'in') return this.showToast('⚠️ ไม่สามารถเปลี่ยนกะระหว่างทำงานได้', 'warning');
        this.selectedShift = shiftName;
        this.updateAllDisplays();
        this.showToast(`เลือกกะ ${shiftName}`, 'success');
    }

    checkIn() {
        if (!this.selectedShift) return this.showToast('⚠️ กรุณาเลือกกะทำงานก่อน', 'warning');
        if (this.currentStatus === 'in' || this.isRecordForToday()) return this.showToast('❌ วันนี้มีการบันทึกข้อมูลแล้ว', 'error');
        
        this.currentStatus = 'in';
        this.checkInTime = new Date().toISOString();
        localStorage.setItem(this.STORAGE_KEYS.STATUS, this.currentStatus);
        localStorage.setItem(this.STORAGE_KEYS.CHECK_IN_TIME, this.checkInTime);
        localStorage.setItem(this.STORAGE_KEYS.TODAY_DATA, JSON.stringify({ shift: this.selectedShift, isDouble: this.isDoublePay }));
        
        this.updateAllDisplays();
        this.showToast(`🟢 เข้างานกะ ${this.selectedShift} ${this.isDoublePay ? '(2 แรง)' : ''}`, 'success');
    }

    checkOut() {
        if (this.currentStatus === 'out') return;

        const now = new Date();
        const checkInDate = new Date(this.checkInTime);
        const todayData = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TODAY_DATA));
        const earnings = this.calculateEarnings(todayData.shift, todayData.isDouble);

        const record = {
            id: Date.now(),
            checkIn: checkInDate.toISOString(),
            checkOut: now.toISOString(),
            shift: todayData.shift,
            isDoublePay: todayData.isDouble,
            note: '',
            earnings: earnings
        };
        this.records.unshift(record);
        this.saveRecords();
        
        this.resetStateAfterCheckout();
        this.updateAllDisplays();
        this.showToast(`🔴 ออกงานสำเร็จ! รายได้: ฿${earnings.toLocaleString()}`, 'success');
    }

    logPaidDayOff() {
        if (this.currentStatus === 'in' || this.isRecordForToday()) return this.showToast('❌ วันนี้มีการบันทึกข้อมูลแล้ว', 'error');
        if (!confirm('คุณต้องการบันทึกวันนี้เป็น "วันหยุด (ได้เงิน)" หรือไม่?')) return;

        const now = new Date();
        const earnings = this.calculateEarnings('PaidHoliday', false);
        const record = {
            id: Date.now(),
            checkIn: now.toISOString(),
            checkOut: now.toISOString(),
            shift: 'PaidHoliday',
            isDoublePay: false,
            note: 'วันหยุดนักขัตฤกษ์',
            earnings: earnings
        };
        this.records.unshift(record);
        this.saveRecords();
        this.updateAllDisplays();
        this.showToast(`💜 บันทึกวันหยุดสำเร็จ`, 'success');
    }

    // --- DATA & STATE MANAGEMENT ---
    saveRecords() {
        localStorage.setItem(this.STORAGE_KEYS.RECORDS, JSON.stringify(this.records));
    }

    resetStateAfterCheckout() {
        this.currentStatus = 'out';
        this.checkInTime = null;
        this.selectedShift = null;
        this.isDoublePay = false;
        document.getElementById('doublePayToggle').checked = false;

        localStorage.removeItem(this.STORAGE_KEYS.STATUS);
        localStorage.removeItem(this.STORAGE_KEYS.CHECK_IN_TIME);
        localStorage.removeItem(this.STORAGE_KEYS.TODAY_DATA);
    }

    isRecordForToday() {
        const todayStr = new Date().toLocaleDateString('th-TH');
        return this.records.some(r => new Date(r.checkIn).toLocaleDateString('th-TH') === todayStr);
    }
    
    calculateEarnings(shift, isDouble) {
        const rateMap = {
            Morning: this.settings.rateMorning,
            Afternoon: this.settings.rateAfternoon,
            Night: this.settings.rateNight,
            PaidHoliday: this.settings.ratePaidHoliday
        };
        const baseRate = parseFloat(rateMap[shift]) || 0;
        return isDouble ? baseRate * 2 : baseRate;
    }

    formatDuration(checkIn, checkOut, shift) {
        if (shift === 'PaidHoliday') return 'วันหยุด';
        const totalMinutes = Math.floor((new Date(checkOut) - new Date(checkIn)) / 60000);
        if (totalMinutes < 0) return 'N/A';
        return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    }

    // --- MODAL & MENU MANAGEMENT ---
    openModal(modalId) { const el = document.getElementById(modalId); el.classList.replace('pointer-events-none', 'modal-active'); el.classList.remove('opacity-0'); el.querySelector('.modal-content').classList.remove('-translate-y-10'); }
    closeModal(modalId) { const el = document.getElementById(modalId); el.classList.replace('modal-active', 'pointer-events-none'); el.classList.add('opacity-0'); el.querySelector('.modal-content').classList.add('-translate-y-10'); }

    openSettingsModal() {
        document.getElementById('rateMorning').value = this.settings.rateMorning;
        document.getElementById('rateAfternoon').value = this.settings.rateAfternoon;
        document.getElementById('rateNight').value = this.settings.rateNight;
        document.getElementById('ratePaidHoliday').value = this.settings.ratePaidHoliday;
        this.openModal('settingsModal');
    }

    saveSettings() {
        this.settings.rateMorning = parseInt(document.getElementById('rateMorning').value) || 380;
        this.settings.rateAfternoon = parseInt(document.getElementById('rateAfternoon').value) || 380;
        this.settings.rateNight = parseInt(document.getElementById('rateNight').value) || 380;
        this.settings.ratePaidHoliday = parseInt(document.getElementById('ratePaidHoliday').value) || 380;
        localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        this.showToast('✅ บันทึกการตั้งค่าแล้ว', 'success');
        this.closeModal('settingsModal');
        this.updateAllDisplays();
    }

    resetSettings() {
        if (!confirm('คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?')) return;
        this.settings = this.getDefaultSettings();
        this.openSettingsModal(); 
        this.showToast('🔄 รีเซ็ตการตั้งค่าแล้ว', 'info');
    }
    
    openEditModal(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        document.getElementById('editRecordId').value = record.id;
        document.getElementById('editShiftType').value = record.shift;
        document.getElementById('editIsDoublePay').checked = record.isDoublePay;
        document.getElementById('editNote').value = record.note || '';

        const toLocalISOString = dateStr => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const tzoffset = date.getTimezoneOffset() * 60000;
            return new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
        };
        document.getElementById('editCheckIn').value = toLocalISOString(record.checkIn);
        document.getElementById('editCheckOut').value = toLocalISOString(record.checkOut);
        
        const isHoliday = record.shift === 'PaidHoliday';
        document.getElementById('editCheckIn').disabled = isHoliday;
        document.getElementById('editCheckOut').disabled = isHoliday;
        document.getElementById('editIsDoublePay').disabled = isHoliday;

        this.openModal('editModal');
    }

    saveEdit() {
        const recordId = parseInt(document.getElementById('editRecordId').value);
        const recordIndex = this.records.findIndex(r => r.id === recordId);
        if (recordIndex === -1) return;

        const updatedShift = document.getElementById('editShiftType').value;
        const updatedIsDoublePay = document.getElementById('editIsDoublePay').checked;
        
        this.records[recordIndex].shift = updatedShift;
        this.records[recordIndex].isDoublePay = updatedIsDoublePay;
        this.records[recordIndex].note = document.getElementById('editNote').value;
        this.records[recordIndex].checkIn = new Date(document.getElementById('editCheckIn').value).toISOString();
        this.records[recordIndex].checkOut = new Date(document.getElementById('editCheckOut').value).toISOString();
        this.records[recordIndex].earnings = this.calculateEarnings(updatedShift, updatedIsDoublePay);

        this.saveRecords();
        this.showToast('✅ แก้ไขบันทึกสำเร็จ', 'success');
        this.closeModal('editModal');
        this.updateAllDisplays();
    }

    deleteRecord(recordId) {
        if (!confirm('คุณแน่ใจหรือไม่ที่จะลบบันทึกนี้?')) return;
        this.records = this.records.filter(r => r.id !== recordId);
        this.saveRecords();
        this.showToast('🗑️ ลบบันทึกแล้ว', 'info');
        this.updateAllDisplays();
    }

    showRecordActions(recordId, event) {
        event.stopPropagation();
        const menu = document.getElementById('recordActionMenu');
        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.right + window.scrollX - menu.offsetWidth}px`;
        menu.classList.remove('hidden');

        document.getElementById('menuEditBtn').onclick = () => { this.openEditModal(recordId); this.hideRecordActions(); };
        document.getElementById('menuDeleteBtn').onclick = () => { this.deleteRecord(recordId); this.hideRecordActions(); };
    }

    hideRecordActions() {
        document.getElementById('recordActionMenu').classList.add('hidden');
    }

    // --- UI DISPLAY FUNCTIONS ---
    updateAllDisplays() {
        this.updateShiftSelectionUI();
        this.updateButtonStates();
        this.updateStatusDisplay();
        this.updateCalendar();
        this.updateWigAnalysis();
        this.updateRecordsList();
    }
    
    updateShiftSelectionUI() { document.querySelectorAll('.shift-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.shift === this.selectedShift)); }
    
    updateButtonStates() {
        const hasRecordToday = this.isRecordForToday();
        const isCheckedIn = this.currentStatus === 'in';
        document.getElementById('checkInBtn').disabled = !this.selectedShift || isCheckedIn || hasRecordToday;
        document.getElementById('checkOutBtn').disabled = !isCheckedIn;
        document.getElementById('paidDayOffBtn').disabled = isCheckedIn || hasRecordToday;
        document.querySelectorAll('.shift-btn').forEach(btn => btn.disabled = isCheckedIn);
        document.getElementById('doublePayToggle').disabled = isCheckedIn || hasRecordToday;
    }

    updateStatusDisplay() {
        const statusDisplay = document.getElementById('statusDisplay');
        if (this.currentStatus === 'in' && this.checkInTime) {
            statusDisplay.classList.remove('hidden');
            const update = () => {
                const diff = new Date() - new Date(this.checkInTime);
                const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
                const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
                const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
                const todayData = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TODAY_DATA));
                statusDisplay.innerHTML = `
                    <div class="font-semibold text-lg">🟢 กำลังทำงาน (กะ ${todayData.shift} ${todayData.isDouble ? ' x2' : ''})</div>
                    <div class="text-3xl font-bold mt-2 font-mono">${h}:${m}:${s}</div>
                `;
            };
            if(this.workTimeInterval) clearInterval(this.workTimeInterval);
            this.workTimeInterval = setInterval(update, 1000);
            update();
        } else {
            statusDisplay.classList.add('hidden');
            if(this.workTimeInterval) clearInterval(this.workTimeInterval);
        }
    }
    
    updateCalendar() {
        const calendar = document.getElementById('calendar');
        document.getElementById('currentMonth').textContent = this.currentCalendarDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });
        const { year, month } = { year: this.currentCalendarDate.getFullYear(), month: this.currentCalendarDate.getMonth() };
        
        const firstDayOfMonth = new Date(year, month, 1);
        let firstDayIndex = firstDayOfMonth.getDay(); 

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        calendar.innerHTML = '';
        ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].forEach(day => calendar.innerHTML += `<div class="text-center text-white/70 font-semibold text-xs py-2">${day}</div>`);
        
        for (let i = 0; i < firstDayIndex; i++) {
            calendar.innerHTML += '<div></div>';
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const dateStr = currentDate.toLocaleDateString('th-TH');
            let dayClass = 'text-white p-1 rounded-lg text-center cursor-pointer calendar-day h-16 flex flex-col justify-center items-center text-sm transition-transform';
            const record = this.records.find(r => new Date(r.checkIn).toLocaleDateString('th-TH') === dateStr);
            if (record) {
                dayClass += record.shift === 'PaidHoliday' ? ' paid-holiday-day' : ' work-day';
            } else if (currentDate < today) {
                dayClass += ' no-work-day';
            }
            if (currentDate.getTime() === today.getTime()) dayClass += ' today';
            
            let content = `<div class="font-semibold">${day}</div>`;
            if (record) {
                const icon = record.shift === 'PaidHoliday' ? '💜' : record.isDoublePay ? '💰' : '✔️';
                content += `<div class="text-xs mt-1 bg-black/20 px-1 rounded">${icon} ฿${record.earnings.toLocaleString()}</div>`;
            }
            calendar.innerHTML += `<div class="${dayClass}" onclick="tracker.handleDayClick('${dateStr}')">${content}</div>`;
        }
    }

    handleDayClick(dateStr) {
        const record = this.records.find(r => new Date(r.checkIn).toLocaleDateString('th-TH') === dateStr);
        if (record) this.openEditModal(record.id);
    }

    updateWigAnalysis() {
        const now = new Date();
        const day = now.getDate();
        const wigNum = day <= 15 ? 1 : 2;
        const start = new Date(now.getFullYear(), now.getMonth(), wigNum === 1 ? 1 : 16);
        const end = wigNum === 1 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start.setHours(0,0,0,0); end.setHours(23,59,59,999);
        
        const recordsInWig = this.records.filter(r => {
            const checkInDate = new Date(r.checkIn);
            return checkInDate >= start && checkInDate <= end;
        });
        const earnings = recordsInWig.reduce((sum, r) => sum + r.earnings, 0);
        const workDays = recordsInWig.filter(r => r.shift !== 'PaidHoliday').length;
        const holidays = recordsInWig.length - workDays;
        const shifts = { Morning: 0, Afternoon: 0, Night: 0 };
        recordsInWig.forEach(r => { if(shifts.hasOwnProperty(r.shift)) shifts[r.shift]++; });
        const fDate = date => date.toLocaleDateString('th-TH', {day: 'numeric', month: 'short'});

        document.getElementById('wigAnalysis').innerHTML = `
             <div class="p-3 glass-effect rounded-lg text-sm">
                <div class="flex justify-between"><span>รอบ (วิค ${wigNum}):</span> <span class="font-semibold">${fDate(start)} - ${fDate(end)}</span></div>
                <div class="flex justify-between mt-2"><span>วันทำงาน:</span> <span class="font-semibold text-green-300">${workDays} วัน</span></div>
                <div class="flex justify-between"><span>วันหยุด(ได้เงิน):</span> <span class="font-semibold text-purple-300">${holidays} วัน</span></div>
                <div class="flex justify-between mt-2"><span>รายได้รวม:</span> <span class="font-semibold text-green-300">฿${earnings.toLocaleString()}</span></div>
                <hr class="border-white/20 my-2">
                <div class="text-xs">
                     <div>🌞 กะเช้า: ${shifts.Morning} | 🌤️ กะบ่าย: ${shifts.Afternoon} | 🌙 กะดึก: ${shifts.Night}</div>
                </div>
            </div>`;
    }

    updateRecordsList() {
        const listDiv = document.getElementById('recordsList');
        if (this.records.length === 0) {
            listDiv.innerHTML = `<div class="text-center text-white/60 py-8">ยังไม่มีบันทึก</div>`;
            return;
        }
        
        this.records.sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
        listDiv.innerHTML = this.records.map(r => {
            const checkIn = new Date(r.checkIn);
            const date = checkIn.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
            let details, icon;
            if (r.shift === 'PaidHoliday') {
                icon = '💜'; details = 'วันหยุด (ได้เงิน)';
            } else {
                icon = { Morning: '🌞', Afternoon: '🌤️', Night: '🌙' }[r.shift] || '💼';
                details = `กะ ${r.shift}${r.isDoublePay ? ' (x2)' : ''}`;
            }
            return `
            <div class="bg-white/5 rounded-lg p-3 text-sm hover:bg-white/10 relative group transition-colors">
                <div class="flex justify-between items-center">
                    <div>
                        <div class="font-bold">${date}</div>
                        <div class="text-xs text-white/70">${icon} ${details}</div>
                        ${r.note ? `<div class="text-xs text-yellow-300 mt-1">📝 ${r.note}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <div class="font-semibold">${this.formatDuration(r.checkIn, r.checkOut, r.shift)}</div>
                        <div class="text-xs text-green-300 font-bold">฿${r.earnings.toLocaleString()}</div>
                    </div>
                </div>
                <div class="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="action-menu-trigger bg-black/20 p-1 rounded-full hover:bg-black/40" onclick="tracker.showRecordActions(${r.id}, event)">
                         <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // --- UTILITY ---
    startClock() {
        const clockEl = document.getElementById('currentTime');
        const update = () => {
            clockEl.textContent = new Date().toLocaleString('th-TH', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        };
        setInterval(update, 1000);
        update();
    }

    changeMonth(direction) {
        this.currentCalendarDate.setDate(1);
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + direction);
        this.updateCalendar();
    }
    
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
        
        toast.className = `p-3 rounded-lg shadow-xl text-white text-sm transition-all duration-300 transform translate-x-full opacity-0 ${colors[type]}`;
        toast.innerHTML = `<span class="mr-2">${icons[type]}</span> ${message}`;
        toastContainer.prepend(toast);

        setTimeout(() => {
            toast.classList.remove('translate-x-full', 'opacity-0');
        }, 10);
        
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-x-full');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3500);
    }
}

const tracker = new DinoBotWorkTracker();

// เมื่อผู้ใช้กำลังจะออกจากหน้าเว็บ (รีเฟรช, ปิดแท็บ) ให้ลบสถานะการล็อกอินทิ้ง
window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('isAuthenticated');
});
