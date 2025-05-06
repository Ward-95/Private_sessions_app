function showPage(pageId) {
  document.querySelectorAll("div[id$='Page']").forEach(p => p.style.display = "none");
  document.getElementById(pageId).style.display = "block";

  document.querySelectorAll(".nav-button").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`[onclick="showPage('${pageId}')"]`).classList.add("active");

  if (pageId === "dailyPage" || pageId === "monthlyPage") loadTables();
}

let db;
const request = indexedDB.open("PrivateSessionsDB", 1);

request.onupgradeneeded = e => {
  db = e.target.result;
  db.createObjectStore("sessions", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = e => {
  db = e.target.result;
};

document.getElementById("sessionForm").onsubmit = e => {
  e.preventDefault();
  const session = {
    studentName: studentName.value.trim(),
    sessionDate: sessionDate.value,
    price: parseFloat(price.value),
    notes: notes.value.trim()
  };

  const tx = db.transaction("sessions", "readwrite");
  tx.objectStore("sessions").add(session);
  tx.oncomplete = () => {
    e.target.reset();
    alert("تم حفظ الجلسة!");
  };
};

function loadTables() {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const filterName = document.getElementById("filterStudent")?.value.trim();

  const tx = db.transaction("sessions", "readonly");
  const store = tx.objectStore("sessions");
  store.getAll().onsuccess = e => {
    const sessions = e.target.result;
    const daily = sessions.filter(s => s.sessionDate?.startsWith(today));
    const monthly = sessions.filter(s => s.sessionDate?.startsWith(month) &&
      (!filterName || s.studentName.includes(filterName)));

    fillTable("dailyTable", daily, true);
    fillTable("monthlyTable", monthly, false);
    updateMonthlySummary(monthly);
  };
}

function fillTable(tableId, data, editable) {
  const tbody = document.getElementById(tableId).querySelector("tbody");
  tbody.innerHTML = "";
  data.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.studentName}</td>
      <td>${s.sessionDate}</td>
      <td>${s.price}</td>
      <td>${s.notes}</td>
      ${editable ? `
        <td>
          <button onclick="editSession(${s.id})">تعديل</button>
          <button onclick="deleteSession(${s.id})" style="background:red;color:#fff;">حذف</button>
        </td>` : ""
      }
    `;
    tbody.appendChild(tr);
  });
}

function editSession(id) {
  const tx = db.transaction("sessions", "readonly");
  const store = tx.objectStore("sessions");
  store.get(id).onsuccess = e => {
    const s = e.target.result;
    studentName.value = s.studentName;
    sessionDate.value = s.sessionDate;
    price.value = s.price;
    notes.value = s.notes;

    const delTx = db.transaction("sessions", "readwrite");
    delTx.objectStore("sessions").delete(id);
    delTx.oncomplete = () => loadTables();
    showPage("formPage");
  };
}

function deleteSession(id) {
  if (!confirm("هل أنت متأكد من حذف هذه الجلسة؟")) return;
  const tx = db.transaction("sessions", "readwrite");
  tx.objectStore("sessions").delete(id).onsuccess = () => loadTables();
}

function updateMonthlySummary(sessions) {
  const totalSessions = sessions.length;
  const totalPrice = sessions.reduce((sum, s) => sum + (s.price || 0), 0);
  document.getElementById("monthlySummary").innerHTML = `
    <p><strong>عدد الجلسات:</strong> ${totalSessions}</p>
    <p><strong>مجموع المبالغ:</strong> ${totalPrice} ريال</p>
  `;
}

document.getElementById("exportExcel").onclick = () => {
  const tx = db.transaction("sessions", "readonly");
  const store = tx.objectStore("sessions");
  store.getAll().onsuccess = e => {
    const data = e.target.result.map(s => ({
      "الاسم": s.studentName,
      "التاريخ": s.sessionDate,
      "السعر": s.price,
      "ملاحظات": s.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل شهري");
    XLSX.writeFile(wb, "سجل_الخصوصي.xlsx");
  };
};
