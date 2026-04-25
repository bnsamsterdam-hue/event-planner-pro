(() => {
  const STORAGE_KEY = "event-planner-pro-v8-data";

  const PAGE_META = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Centraal overzicht van planning, opdrachten en facturatie."
    },
    orders: {
      title: "Opdrachten overzicht",
      subtitle: "Zoek, bewerk en verwijder opdrachten in realtime."
    },
    "new-order": {
      title: "Nieuwe opdracht",
      subtitle: "Nieuwe opdracht opslaan met klant, locatie, materialen en budget."
    },
    customers: {
      title: "Klanten",
      subtitle: "Beheer klantgegevens met zoeken, opslaan, bewerken en verwijderen."
    },
    locations: {
      title: "Locaties",
      subtitle: "Beheer eventlocaties inclusief capaciteit en adresinformatie."
    },
    materials: {
      title: "Materialen",
      subtitle: "Materiaalbeheer met code, categorie, voorraad en dagprijs."
    },
    invoices: {
      title: "Facturen",
      subtitle: "Facturen aanmaken, wijzigen en opvolgen met statusbeheer."
    }
  };

  const state = {
    customers: [],
    locations: [],
    materials: [],
    orders: [],
    invoices: [],
    sequences: {
      order: 1,
      invoice: 1
    }
  };

  const ui = {
    navItems: Array.from(document.querySelectorAll(".nav-item")),
    pages: Array.from(document.querySelectorAll(".page")),
    pageTitle: document.getElementById("page-title"),
    pageSubtitle: document.getElementById("page-subtitle"),
    statOrders: document.getElementById("stat-orders"),
    statOpenOrders: document.getElementById("stat-open-orders"),
    statCustomers: document.getElementById("stat-customers"),
    statOpenInvoices: document.getElementById("stat-open-invoices"),
    dashboardUpcoming: document.getElementById("dashboard-upcoming"),
    dashboardInvoices: document.getElementById("dashboard-invoices"),

    ordersSearch: document.getElementById("orders-search"),
    ordersList: document.getElementById("orders-list"),
    ordersEditForm: document.getElementById("orders-edit-form"),
    editOrderId: document.getElementById("edit-order-id"),
    editOrderNumber: document.getElementById("edit-order-number"),
    editOrderTitle: document.getElementById("edit-order-title"),
    editOrderCustomer: document.getElementById("edit-order-customer"),
    editOrderLocation: document.getElementById("edit-order-location"),
    editOrderStart: document.getElementById("edit-order-start"),
    editOrderEnd: document.getElementById("edit-order-end"),
    editOrderStatus: document.getElementById("edit-order-status"),
    editOrderBudget: document.getElementById("edit-order-budget"),
    editOrderMaterials: document.getElementById("edit-order-materials"),
    editOrderNotes: document.getElementById("edit-order-notes"),
    ordersDeleteBtn: document.getElementById("orders-delete-btn"),
    ordersClearBtn: document.getElementById("orders-clear-btn"),

    newOrderForm: document.getElementById("new-order-form"),
    newOrderNumber: document.getElementById("new-order-number"),
    newOrderTitle: document.getElementById("new-order-title"),
    newOrderCustomer: document.getElementById("new-order-customer"),
    newOrderLocation: document.getElementById("new-order-location"),
    newOrderStart: document.getElementById("new-order-start"),
    newOrderEnd: document.getElementById("new-order-end"),
    newOrderStatus: document.getElementById("new-order-status"),
    newOrderBudget: document.getElementById("new-order-budget"),
    newOrderMaterials: document.getElementById("new-order-materials"),
    newOrderNotes: document.getElementById("new-order-notes"),
    newOrderResetBtn: document.getElementById("new-order-reset-btn"),

    customersSearch: document.getElementById("customers-search"),
    customersList: document.getElementById("customers-list"),
    customersForm: document.getElementById("customers-form"),
    customerId: document.getElementById("customer-id"),
    customerName: document.getElementById("customer-name"),
    customerContact: document.getElementById("customer-contact"),
    customerEmail: document.getElementById("customer-email"),
    customerPhone: document.getElementById("customer-phone"),
    customerDeleteBtn: document.getElementById("customer-delete-btn"),
    customerClearBtn: document.getElementById("customer-clear-btn"),

    locationsSearch: document.getElementById("locations-search"),
    locationsList: document.getElementById("locations-list"),
    locationsForm: document.getElementById("locations-form"),
    locationId: document.getElementById("location-id"),
    locationName: document.getElementById("location-name"),
    locationAddress: document.getElementById("location-address"),
    locationCity: document.getElementById("location-city"),
    locationCapacity: document.getElementById("location-capacity"),
    locationDeleteBtn: document.getElementById("location-delete-btn"),
    locationClearBtn: document.getElementById("location-clear-btn"),

    materialsSearch: document.getElementById("materials-search"),
    materialsList: document.getElementById("materials-list"),
    materialsForm: document.getElementById("materials-form"),
    materialId: document.getElementById("material-id"),
    materialCode: document.getElementById("material-code"),
    materialName: document.getElementById("material-name"),
    materialCategory: document.getElementById("material-category"),
    materialStock: document.getElementById("material-stock"),
    materialPrice: document.getElementById("material-price"),
    materialDeleteBtn: document.getElementById("material-delete-btn"),
    materialClearBtn: document.getElementById("material-clear-btn"),

    invoicesSearch: document.getElementById("invoices-search"),
    invoicesList: document.getElementById("invoices-list"),
    invoicesForm: document.getElementById("invoices-form"),
    invoiceId: document.getElementById("invoice-id"),
    invoiceNumber: document.getElementById("invoice-number"),
    invoiceOrder: document.getElementById("invoice-order"),
    invoiceIssueDate: document.getElementById("invoice-issue-date"),
    invoiceDueDate: document.getElementById("invoice-due-date"),
    invoiceStatus: document.getElementById("invoice-status"),
    invoiceAmount: document.getElementById("invoice-amount"),
    invoiceNotes: document.getElementById("invoice-notes"),
    invoiceDeleteBtn: document.getElementById("invoice-delete-btn"),
    invoiceClearBtn: document.getElementById("invoice-clear-btn")
  };

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function readStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function generateOrderNumber() {
    const year = new Date().getFullYear();
    const number = String(state.sequences.order).padStart(4, "0");
    return `ORD-${year}-${number}`;
  }

  function generateInvoiceNumber() {
    const year = new Date().getFullYear();
    const number = String(state.sequences.invoice).padStart(4, "0");
    return `INV-${year}-${number}`;
  }

  function mapToOptions(collection, labelBuilder) {
    return collection.map((item) => `<option value="${item.id}">${labelBuilder(item)}</option>`).join("");
  }

  function findById(collection, id) {
    return collection.find((item) => item.id === id) || null;
  }

  function getSelectedValues(selectElement) {
    return Array.from(selectElement.selectedOptions).map((option) => option.value);
  }

  function setSelectedValues(selectElement, values) {
    const set = new Set(values || []);
    Array.from(selectElement.options).forEach((option) => {
      option.selected = set.has(option.value);
    });
  }

  function setPage(pageName) {
    ui.navItems.forEach((button) => {
      button.classList.toggle("active", button.dataset.page === pageName);
    });
    ui.pages.forEach((page) => {
      page.classList.toggle("active", page.dataset.page === pageName);
    });
    const meta = PAGE_META[pageName] || PAGE_META.dashboard;
    ui.pageTitle.textContent = meta.title;
    ui.pageSubtitle.textContent = meta.subtitle;
  }

  function showEmpty(container, message) {
    container.innerHTML = `<div class="empty">${message}</div>`;
  }

  function refreshOrderSelects() {
    const customerOptions = mapToOptions(state.customers, (item) => item.name);
    const locationOptions = mapToOptions(state.locations, (item) => `${item.name} (${item.city})`);
    const materialOptions = mapToOptions(
      state.materials,
      (item) => `${item.code} - ${item.name} (${item.stock} st.)`
    );

    ui.newOrderCustomer.innerHTML = customerOptions;
    ui.editOrderCustomer.innerHTML = customerOptions;
    ui.newOrderLocation.innerHTML = locationOptions;
    ui.editOrderLocation.innerHTML = locationOptions;
    ui.newOrderMaterials.innerHTML = materialOptions;
    ui.editOrderMaterials.innerHTML = materialOptions;

    const orderOptions = mapToOptions(
      state.orders,
      (item) => `${item.orderNumber} - ${item.title}`
    );
    ui.invoiceOrder.innerHTML = orderOptions;
  }

  function refreshCounters() {
    ui.statOrders.textContent = String(state.orders.length);
    ui.statOpenOrders.textContent = String(
      state.orders.filter((item) => item.status !== "afgerond" && item.status !== "geannuleerd").length
    );
    ui.statCustomers.textContent = String(state.customers.length);
    ui.statOpenInvoices.textContent = String(
      state.invoices.filter((item) => item.status !== "betaald").length
    );
  }

  function renderDashboard() {
    const upcoming = [...state.orders]
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);

    if (upcoming.length === 0) {
      showEmpty(ui.dashboardUpcoming, "Nog geen opdrachten gepland.");
    } else {
      ui.dashboardUpcoming.innerHTML = upcoming
        .map((order) => {
          const customer = findById(state.customers, order.customerId)?.name || "Onbekende klant";
          const location = findById(state.locations, order.locationId)?.name || "Onbekende locatie";
          return `
            <article class="list-item">
              <h4>${order.orderNumber} - ${order.title}</h4>
              <p>${customer} | ${location}</p>
              <p>${order.startDate} t/m ${order.endDate} | ${order.status}</p>
            </article>
          `;
        })
        .join("");
    }

    const invoices = [...state.invoices].slice(0, 5);
    if (invoices.length === 0) {
      showEmpty(ui.dashboardInvoices, "Nog geen facturen aangemaakt.");
    } else {
      ui.dashboardInvoices.innerHTML = invoices
        .map((invoice) => {
          const order = findById(state.orders, invoice.orderId);
          const orderRef = order ? order.orderNumber : "Geen gekoppelde opdracht";
          return `
            <article class="list-item">
              <h4>${invoice.invoiceNumber}</h4>
              <p>${orderRef} | ${invoice.status}</p>
              <p>EUR ${Number(invoice.amount).toFixed(2)} | Vervalt: ${invoice.dueDate}</p>
            </article>
          `;
        })
        .join("");
    }
  }

  function orderSearchText(order) {
    const customer = findById(state.customers, order.customerId)?.name || "";
    const location = findById(state.locations, order.locationId)?.name || "";
    return [
      order.orderNumber,
      order.title,
      customer,
      location,
      order.status,
      order.notes,
      order.startDate,
      order.endDate
    ]
      .join(" ")
      .toLowerCase();
  }

  function renderOrdersList() {
    const query = ui.ordersSearch.value.trim().toLowerCase();
    const list = state.orders.filter((order) => orderSearchText(order).includes(query));

    if (list.length === 0) {
      showEmpty(ui.ordersList, "Geen opdrachten gevonden voor deze zoekopdracht.");
      return;
    }

    ui.ordersList.innerHTML = list
      .map((order) => {
        const customer = findById(state.customers, order.customerId)?.name || "Onbekende klant";
        const location = findById(state.locations, order.locationId)?.name || "Onbekende locatie";
        return `
          <article class="list-item">
            <h4>${order.orderNumber} - ${order.title}</h4>
            <p>${customer} | ${location} | ${order.status}</p>
            <p>${order.startDate} t/m ${order.endDate} | EUR ${Number(order.budget).toFixed(2)}</p>
            <div class="item-actions">
              <button type="button" class="mini-ghost" data-action="edit-order" data-id="${order.id}">Bewerken</button>
              <button type="button" class="mini-danger" data-action="delete-order" data-id="${order.id}">Verwijderen</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function resetNewOrderForm() {
    ui.newOrderForm.reset();
    ui.newOrderNumber.value = generateOrderNumber();
    ui.newOrderStatus.value = "concept";
    if (ui.newOrderCustomer.options.length > 0) ui.newOrderCustomer.selectedIndex = 0;
    if (ui.newOrderLocation.options.length > 0) ui.newOrderLocation.selectedIndex = 0;
    setSelectedValues(ui.newOrderMaterials, []);
  }

  function resetEditOrderForm() {
    ui.ordersEditForm.reset();
    ui.editOrderId.value = "";
    ui.editOrderNumber.value = "";
    setSelectedValues(ui.editOrderMaterials, []);
  }

  function loadOrderForEdit(orderId) {
    const order = findById(state.orders, orderId);
    if (!order) return;
    ui.editOrderId.value = order.id;
    ui.editOrderNumber.value = order.orderNumber;
    ui.editOrderTitle.value = order.title;
    ui.editOrderCustomer.value = order.customerId;
    ui.editOrderLocation.value = order.locationId;
    ui.editOrderStart.value = order.startDate;
    ui.editOrderEnd.value = order.endDate;
    ui.editOrderStatus.value = order.status;
    ui.editOrderBudget.value = String(order.budget);
    ui.editOrderNotes.value = order.notes || "";
    setSelectedValues(ui.editOrderMaterials, order.materialIds || []);
    setPage("orders");
  }

  function customerSearchText(customer) {
    return [customer.name, customer.contact, customer.email, customer.phone].join(" ").toLowerCase();
  }

  function renderCustomers() {
    const query = ui.customersSearch.value.trim().toLowerCase();
    const list = state.customers.filter((item) => customerSearchText(item).includes(query));

    if (list.length === 0) {
      showEmpty(ui.customersList, "Geen klanten gevonden.");
      return;
    }

    ui.customersList.innerHTML = list
      .map(
        (item) => `
        <article class="list-item">
          <h4>${item.name}</h4>
          <p>${item.contact} | ${item.email}</p>
          <p>${item.phone}</p>
          <div class="item-actions">
            <button type="button" class="mini-ghost" data-action="edit-customer" data-id="${item.id}">Bewerken</button>
            <button type="button" class="mini-danger" data-action="delete-customer" data-id="${item.id}">Verwijderen</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  function resetCustomerForm() {
    ui.customersForm.reset();
    ui.customerId.value = "";
  }

  function loadCustomerForEdit(customerId) {
    const item = findById(state.customers, customerId);
    if (!item) return;
    ui.customerId.value = item.id;
    ui.customerName.value = item.name;
    ui.customerContact.value = item.contact;
    ui.customerEmail.value = item.email;
    ui.customerPhone.value = item.phone;
  }

  function locationSearchText(location) {
    return [location.name, location.address, location.city, location.capacity].join(" ").toLowerCase();
  }

  function renderLocations() {
    const query = ui.locationsSearch.value.trim().toLowerCase();
    const list = state.locations.filter((item) => locationSearchText(item).includes(query));

    if (list.length === 0) {
      showEmpty(ui.locationsList, "Geen locaties gevonden.");
      return;
    }

    ui.locationsList.innerHTML = list
      .map(
        (item) => `
        <article class="list-item">
          <h4>${item.name}</h4>
          <p>${item.address} | ${item.city}</p>
          <p>Capaciteit: ${item.capacity}</p>
          <div class="item-actions">
            <button type="button" class="mini-ghost" data-action="edit-location" data-id="${item.id}">Bewerken</button>
            <button type="button" class="mini-danger" data-action="delete-location" data-id="${item.id}">Verwijderen</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  function resetLocationForm() {
    ui.locationsForm.reset();
    ui.locationId.value = "";
  }

  function loadLocationForEdit(locationId) {
    const item = findById(state.locations, locationId);
    if (!item) return;
    ui.locationId.value = item.id;
    ui.locationName.value = item.name;
    ui.locationAddress.value = item.address;
    ui.locationCity.value = item.city;
    ui.locationCapacity.value = String(item.capacity);
  }

  function materialSearchText(material) {
    return [material.code, material.name, material.category, material.stock, material.price].join(" ").toLowerCase();
  }

  function renderMaterials() {
    const query = ui.materialsSearch.value.trim().toLowerCase();
    const list = state.materials.filter((item) => materialSearchText(item).includes(query));

    if (list.length === 0) {
      showEmpty(ui.materialsList, "Geen materialen gevonden.");
      return;
    }

    ui.materialsList.innerHTML = list
      .map(
        (item) => `
        <article class="list-item">
          <h4>${item.code} - ${item.name}</h4>
          <p>${item.category} | Voorraad: ${item.stock}</p>
          <p>Dagprijs: EUR ${Number(item.price).toFixed(2)}</p>
          <div class="item-actions">
            <button type="button" class="mini-ghost" data-action="edit-material" data-id="${item.id}">Bewerken</button>
            <button type="button" class="mini-danger" data-action="delete-material" data-id="${item.id}">Verwijderen</button>
          </div>
        </article>
      `
      )
      .join("");
  }

  function resetMaterialForm() {
    ui.materialsForm.reset();
    ui.materialId.value = "";
  }

  function loadMaterialForEdit(materialId) {
    const item = findById(state.materials, materialId);
    if (!item) return;
    ui.materialId.value = item.id;
    ui.materialCode.value = item.code;
    ui.materialName.value = item.name;
    ui.materialCategory.value = item.category;
    ui.materialStock.value = String(item.stock);
    ui.materialPrice.value = String(item.price);
  }

  function invoiceSearchText(invoice) {
    const order = findById(state.orders, invoice.orderId);
    return [
      invoice.invoiceNumber,
      invoice.status,
      invoice.amount,
      invoice.issueDate,
      invoice.dueDate,
      invoice.notes,
      order ? `${order.orderNumber} ${order.title}` : ""
    ]
      .join(" ")
      .toLowerCase();
  }

  function renderInvoices() {
    const query = ui.invoicesSearch.value.trim().toLowerCase();
    const list = state.invoices.filter((item) => invoiceSearchText(item).includes(query));

    if (list.length === 0) {
      showEmpty(ui.invoicesList, "Geen facturen gevonden.");
      return;
    }

    ui.invoicesList.innerHTML = list
      .map((item) => {
        const order = findById(state.orders, item.orderId);
        return `
          <article class="list-item">
            <h4>${item.invoiceNumber}</h4>
            <p>${order ? `${order.orderNumber} - ${order.title}` : "Geen opdracht"} | ${item.status}</p>
            <p>EUR ${Number(item.amount).toFixed(2)} | ${item.issueDate} t/m ${item.dueDate}</p>
            <div class="item-actions">
              <button type="button" class="mini-ghost" data-action="edit-invoice" data-id="${item.id}">Bewerken</button>
              <button type="button" class="mini-danger" data-action="delete-invoice" data-id="${item.id}">Verwijderen</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function resetInvoiceForm() {
    ui.invoicesForm.reset();
    ui.invoiceId.value = "";
    ui.invoiceNumber.value = generateInvoiceNumber();
    if (ui.invoiceOrder.options.length > 0) ui.invoiceOrder.selectedIndex = 0;
    ui.invoiceStatus.value = "concept";
  }

  function loadInvoiceForEdit(invoiceId) {
    const item = findById(state.invoices, invoiceId);
    if (!item) return;
    ui.invoiceId.value = item.id;
    ui.invoiceNumber.value = item.invoiceNumber;
    ui.invoiceOrder.value = item.orderId;
    ui.invoiceIssueDate.value = item.issueDate;
    ui.invoiceDueDate.value = item.dueDate;
    ui.invoiceStatus.value = item.status;
    ui.invoiceAmount.value = String(item.amount);
    ui.invoiceNotes.value = item.notes || "";
  }

  function createNewOrder(formValues) {
    const order = {
      id: uid("ord"),
      orderNumber: generateOrderNumber(),
      title: formValues.title,
      customerId: formValues.customerId,
      locationId: formValues.locationId,
      startDate: formValues.startDate,
      endDate: formValues.endDate,
      status: formValues.status,
      budget: formValues.budget,
      materialIds: formValues.materialIds,
      notes: formValues.notes
    };
    state.orders.unshift(order);
    state.sequences.order += 1;
  }

  function deleteOrder(orderId) {
    state.orders = state.orders.filter((item) => item.id !== orderId);
    state.invoices = state.invoices.filter((item) => item.orderId !== orderId);
    if (ui.editOrderId.value === orderId) resetEditOrderForm();
  }

  function deleteCustomer(customerId) {
    state.customers = state.customers.filter((item) => item.id !== customerId);
    state.orders = state.orders.filter((item) => item.customerId !== customerId);
    state.invoices = state.invoices.filter((item) => {
      const order = findById(state.orders, item.orderId);
      return Boolean(order);
    });
  }

  function deleteLocation(locationId) {
    state.locations = state.locations.filter((item) => item.id !== locationId);
    state.orders = state.orders.filter((item) => item.locationId !== locationId);
    state.invoices = state.invoices.filter((item) => {
      const order = findById(state.orders, item.orderId);
      return Boolean(order);
    });
  }

  function deleteMaterial(materialId) {
    state.materials = state.materials.filter((item) => item.id !== materialId);
    state.orders = state.orders.map((order) => ({
      ...order,
      materialIds: (order.materialIds || []).filter((id) => id !== materialId)
    }));
  }

  function refreshAll() {
    refreshOrderSelects();
    refreshCounters();
    renderDashboard();
    renderOrdersList();
    renderCustomers();
    renderLocations();
    renderMaterials();
    renderInvoices();
  }

  function saveAndRender() {
    persist();
    refreshAll();
  }

  function seedData() {
    state.customers = [
      {
        id: uid("cus"),
        name: "Amsterdam Event Group",
        contact: "L. de Vries",
        email: "planning@amsterdameventgroup.nl",
        phone: "+31 20 555 1100"
      },
      {
        id: uid("cus"),
        name: "Noordzee Producties",
        contact: "M. Bakker",
        email: "office@noordzeeproducties.nl",
        phone: "+31 10 444 2200"
      }
    ];

    state.locations = [
      {
        id: uid("loc"),
        name: "RAI Amsterdam Hal 8",
        address: "Europaplein 24",
        city: "Amsterdam",
        capacity: 1200
      },
      {
        id: uid("loc"),
        name: "Werkspoorkathedraal",
        address: "Tractieweg 41",
        city: "Utrecht",
        capacity: 900
      }
    ];

    state.materials = [
      {
        id: uid("mat"),
        code: "TRS-200",
        name: "Truss Segment 2m",
        category: "Rigging",
        stock: 42,
        price: 14.5
      },
      {
        id: uid("mat"),
        code: "LGT-320",
        name: "LED Spot 320W",
        category: "Licht",
        stock: 30,
        price: 32
      }
    ];

    const firstOrder = {
      id: uid("ord"),
      orderNumber: generateOrderNumber(),
      title: "Jaarcongres 2026",
      customerId: state.customers[0].id,
      locationId: state.locations[0].id,
      startDate: "2026-06-18",
      endDate: "2026-06-20",
      status: "ingepland",
      budget: 28500,
      materialIds: [state.materials[0].id, state.materials[1].id],
      notes: "Opbouw start 17 juni, extra crew na 18:00."
    };
    state.orders.push(firstOrder);
    state.sequences.order += 1;

    const firstInvoice = {
      id: uid("inv"),
      invoiceNumber: generateInvoiceNumber(),
      orderId: firstOrder.id,
      issueDate: "2026-04-10",
      dueDate: "2026-05-10",
      status: "verzonden",
      amount: 14500,
      notes: "Eerste termijn factuur."
    };
    state.invoices.push(firstInvoice);
    state.sequences.invoice += 1;
  }

  function hydrateState() {
    const saved = readStorage();
    if (saved) {
      state.customers = Array.isArray(saved.customers) ? saved.customers : [];
      state.locations = Array.isArray(saved.locations) ? saved.locations : [];
      state.materials = Array.isArray(saved.materials) ? saved.materials : [];
      state.orders = Array.isArray(saved.orders) ? saved.orders : [];
      state.invoices = Array.isArray(saved.invoices) ? saved.invoices : [];
      state.sequences = {
        order: Number(saved.sequences?.order || 1),
        invoice: Number(saved.sequences?.invoice || 1)
      };
      return;
    }

    seedData();
    persist();
  }

  function bindNavigation() {
    ui.navItems.forEach((button) => {
      button.addEventListener("click", () => setPage(button.dataset.page));
    });
  }

  function bindOrderEvents() {
    ui.ordersSearch.addEventListener("input", renderOrdersList);

    ui.newOrderForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (state.customers.length === 0 || state.locations.length === 0) {
        alert("Maak eerst minimaal 1 klant en 1 locatie aan voordat je een opdracht opslaat.");
        return;
      }

      createNewOrder({
        title: ui.newOrderTitle.value.trim(),
        customerId: ui.newOrderCustomer.value,
        locationId: ui.newOrderLocation.value,
        startDate: ui.newOrderStart.value,
        endDate: ui.newOrderEnd.value,
        status: ui.newOrderStatus.value,
        budget: Number(ui.newOrderBudget.value),
        materialIds: getSelectedValues(ui.newOrderMaterials),
        notes: ui.newOrderNotes.value.trim()
      });

      saveAndRender();
      resetNewOrderForm();
      setPage("orders");
    });

    ui.newOrderResetBtn.addEventListener("click", () => {
      resetNewOrderForm();
    });

    ui.ordersList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.action;

      if (action === "edit-order") {
        loadOrderForEdit(id);
        return;
      }

      if (action === "delete-order") {
        deleteOrder(id);
        saveAndRender();
      }
    });

    ui.ordersEditForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const orderId = ui.editOrderId.value;
      if (!orderId) {
        alert("Selecteer eerst een opdracht via Opdrachten overzicht.");
        return;
      }

      const index = state.orders.findIndex((item) => item.id === orderId);
      if (index < 0) return;

      state.orders[index] = {
        ...state.orders[index],
        title: ui.editOrderTitle.value.trim(),
        customerId: ui.editOrderCustomer.value,
        locationId: ui.editOrderLocation.value,
        startDate: ui.editOrderStart.value,
        endDate: ui.editOrderEnd.value,
        status: ui.editOrderStatus.value,
        budget: Number(ui.editOrderBudget.value),
        materialIds: getSelectedValues(ui.editOrderMaterials),
        notes: ui.editOrderNotes.value.trim()
      };

      saveAndRender();
    });

    ui.ordersDeleteBtn.addEventListener("click", () => {
      const orderId = ui.editOrderId.value;
      if (!orderId) {
        alert("Selecteer eerst een opdracht om te verwijderen.");
        return;
      }
      deleteOrder(orderId);
      saveAndRender();
      resetEditOrderForm();
    });

    ui.ordersClearBtn.addEventListener("click", resetEditOrderForm);
  }

  function bindCustomerEvents() {
    ui.customersSearch.addEventListener("input", renderCustomers);

    ui.customersList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "edit-customer") loadCustomerForEdit(id);
      if (action === "delete-customer") {
        deleteCustomer(id);
        saveAndRender();
        if (ui.customerId.value === id) resetCustomerForm();
      }
    });

    ui.customersForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = ui.customerId.value;
      const payload = {
        name: ui.customerName.value.trim(),
        contact: ui.customerContact.value.trim(),
        email: ui.customerEmail.value.trim(),
        phone: ui.customerPhone.value.trim()
      };

      if (id) {
        const index = state.customers.findIndex((item) => item.id === id);
        if (index >= 0) state.customers[index] = { ...state.customers[index], ...payload };
      } else {
        state.customers.unshift({ id: uid("cus"), ...payload });
      }

      saveAndRender();
      resetCustomerForm();
    });

    ui.customerDeleteBtn.addEventListener("click", () => {
      const id = ui.customerId.value;
      if (!id) {
        alert("Selecteer eerst een klant om te verwijderen.");
        return;
      }
      deleteCustomer(id);
      saveAndRender();
      resetCustomerForm();
    });

    ui.customerClearBtn.addEventListener("click", resetCustomerForm);
  }

  function bindLocationEvents() {
    ui.locationsSearch.addEventListener("input", renderLocations);

    ui.locationsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "edit-location") loadLocationForEdit(id);
      if (action === "delete-location") {
        deleteLocation(id);
        saveAndRender();
        if (ui.locationId.value === id) resetLocationForm();
      }
    });

    ui.locationsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = ui.locationId.value;
      const payload = {
        name: ui.locationName.value.trim(),
        address: ui.locationAddress.value.trim(),
        city: ui.locationCity.value.trim(),
        capacity: Number(ui.locationCapacity.value)
      };

      if (id) {
        const index = state.locations.findIndex((item) => item.id === id);
        if (index >= 0) state.locations[index] = { ...state.locations[index], ...payload };
      } else {
        state.locations.unshift({ id: uid("loc"), ...payload });
      }

      saveAndRender();
      resetLocationForm();
    });

    ui.locationDeleteBtn.addEventListener("click", () => {
      const id = ui.locationId.value;
      if (!id) {
        alert("Selecteer eerst een locatie om te verwijderen.");
        return;
      }
      deleteLocation(id);
      saveAndRender();
      resetLocationForm();
    });

    ui.locationClearBtn.addEventListener("click", resetLocationForm);
  }

  function bindMaterialEvents() {
    ui.materialsSearch.addEventListener("input", renderMaterials);

    ui.materialsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "edit-material") loadMaterialForEdit(id);
      if (action === "delete-material") {
        deleteMaterial(id);
        saveAndRender();
        if (ui.materialId.value === id) resetMaterialForm();
      }
    });

    ui.materialsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const id = ui.materialId.value;
      const payload = {
        code: ui.materialCode.value.trim(),
        name: ui.materialName.value.trim(),
        category: ui.materialCategory.value.trim(),
        stock: Number(ui.materialStock.value),
        price: Number(ui.materialPrice.value)
      };

      if (id) {
        const index = state.materials.findIndex((item) => item.id === id);
        if (index >= 0) state.materials[index] = { ...state.materials[index], ...payload };
      } else {
        state.materials.unshift({ id: uid("mat"), ...payload });
      }

      saveAndRender();
      resetMaterialForm();
    });

    ui.materialDeleteBtn.addEventListener("click", () => {
      const id = ui.materialId.value;
      if (!id) {
        alert("Selecteer eerst een materiaal om te verwijderen.");
        return;
      }
      deleteMaterial(id);
      saveAndRender();
      resetMaterialForm();
    });

    ui.materialClearBtn.addEventListener("click", resetMaterialForm);
  }

  function bindInvoiceEvents() {
    ui.invoicesSearch.addEventListener("input", renderInvoices);

    ui.invoicesList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action === "edit-invoice") loadInvoiceForEdit(id);
      if (action === "delete-invoice") {
        state.invoices = state.invoices.filter((item) => item.id !== id);
        saveAndRender();
        if (ui.invoiceId.value === id) resetInvoiceForm();
      }
    });

    ui.invoicesForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.orders.length === 0) {
        alert("Maak eerst een opdracht aan voordat je een factuur opslaat.");
        return;
      }

      const id = ui.invoiceId.value;
      const payload = {
        invoiceNumber: ui.invoiceNumber.value.trim(),
        orderId: ui.invoiceOrder.value,
        issueDate: ui.invoiceIssueDate.value,
        dueDate: ui.invoiceDueDate.value,
        status: ui.invoiceStatus.value,
        amount: Number(ui.invoiceAmount.value),
        notes: ui.invoiceNotes.value.trim()
      };

      if (id) {
        const index = state.invoices.findIndex((item) => item.id === id);
        if (index >= 0) state.invoices[index] = { ...state.invoices[index], ...payload };
      } else {
        state.invoices.unshift({ id: uid("inv"), ...payload });
        state.sequences.invoice += 1;
      }

      saveAndRender();
      resetInvoiceForm();
    });

    ui.invoiceDeleteBtn.addEventListener("click", () => {
      const id = ui.invoiceId.value;
      if (!id) {
        alert("Selecteer eerst een factuur om te verwijderen.");
        return;
      }
      state.invoices = state.invoices.filter((item) => item.id !== id);
      saveAndRender();
      resetInvoiceForm();
    });

    ui.invoiceClearBtn.addEventListener("click", resetInvoiceForm);
  }

  function initDefaultsForForms() {
    resetCustomerForm();
    resetLocationForm();
    resetMaterialForm();
    resetEditOrderForm();
    resetNewOrderForm();
    resetInvoiceForm();
  }

  function init() {
    hydrateState();
    bindNavigation();
    bindOrderEvents();
    bindCustomerEvents();
    bindLocationEvents();
    bindMaterialEvents();
    bindInvoiceEvents();
    refreshAll();
    initDefaultsForForms();
    setPage("dashboard");
  }

  init();
})();
