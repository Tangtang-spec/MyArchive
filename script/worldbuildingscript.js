        // 1. ฟังก์ชันเปิด Modal Popup
        function openModal() {
            document.getElementById('addModal').style.display = 'flex';
        }

        // 2. ฟังก์ชันปิด Modal Popup
        function closeModal() {
            document.getElementById('addModal').style.display = 'none';
            document.getElementById('wbForm').reset();
        }

        // 3. ฟังก์ชันกรองหมวดหมู่ (Category Filtering)
        function filterCategory(category, element) {
            // สลับสถานะ Active ของปุ่ม Tab
            let tabs = document.querySelectorAll('.tab-btn');
            tabs.forEach(tab => tab.classList.remove('active'));
            element.classList.add('active');

            // แสดง/ซ่อน การ์ดตามหมวดหมู่
            let cards = document.querySelectorAll('.wb-card');
            cards.forEach(card => {
                if (category === 'all' || card.getAttribute('data-category') === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        // 4. ฟังก์ชันค้นหาข้อมูลแบบ Real-time (Search Function)
        function searchWorldItems() {
            let input = document.getElementById('searchInput').value.toLowerCase();
            let cards = document.querySelectorAll('.wb-card');

            cards.forEach(card => {
                let title = card.querySelector('.wb-title').innerText.toLowerCase();
                let desc = card.querySelector('.desc').innerText.toLowerCase();

                if (title.includes(input) || desc.includes(input)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        // 5. ฟังก์ชันบันทึกและเพิ่มข้อมูลใหม่ลงในหน้าเว็บ (Dynamic Add)
        function saveWorldItem(event) {
            event.preventDefault();

            let title = document.getElementById('itemTitle').value;
            let category = document.getElementById('itemCategory').value;
            let desc = document.getElementById('itemDesc').value;
            let categoryText = document.getElementById('itemCategory').options[document.getElementById('itemCategory').selectedIndex].text;

            // สร้าง Element การ์ดใหม่
            let newCard = document.createElement('div');
            newCard.className = 'pc-project-card wb-card';
            newCard.setAttribute('data-category', category);

            newCard.innerHTML = `
                <div class="card-cover" style="background: linear-gradient(to bottom, #003d3d, #0b1114);"></div>
                <div class="card-body">
                    <span style="color: #0EF1F1; font-size: 0.75rem; font-weight: 600;">[${categoryText}]</span>
                    <h4 class="wb-title">${title}</h4>
                    <p class="desc">${desc}</p>
                    <div class="card-footer">อัปเดตล่าสุด: เพิ่งสร้างเมื่อครู่</div>
                </div>
            `;

            // เพิ่มเข้าสู่ Grid และปิด Modal
            document.getElementById('worldGrid').prepend(newCard);
            closeModal();
        }