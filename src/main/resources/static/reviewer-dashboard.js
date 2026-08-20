(() => {
    const API_BASE = '/api/nominations';

    const listEl = document.getElementById('nomination-list');
    const countEl = document.getElementById('queue-count');
    const statusMessageEl = document.getElementById('status-message');
    const template = document.getElementById('nomination-card-template');

    const filterStatus = document.getElementById('filter-status');
    const filterPractice = document.getElementById('filter-practice');
    const filterLocation = document.getElementById('filter-location');
    const refreshBtn = document.getElementById('refresh-btn');

    const STATUS_LABELS = {
        PENDING_REVIEW: 'Pending review',
        APPROVED: 'Approved',
        REJECTED: 'Rejected',
        NEEDS_RESUBMISSION: 'Needs resubmission'
    };
    const STATUS_PILL_CLASS = {
        PENDING_REVIEW: 'status-pill--pending',
        APPROVED: 'status-pill--approved',
        REJECTED: 'status-pill--rejected',
        NEEDS_RESUBMISSION: 'status-pill--resubmission'
    };
    const FLAG_LABELS = {
        NOMINEE_NOT_ACTIVE_EMPLOYEE: 'Nominee employment status unclear',
        ROUTINE_TASK_LANGUAGE: 'Routine-task language',
        WEAK_JUSTIFICATION: 'Weak justification',
        REPEAT_NOMINATION_CONSECUTIVE_QUARTER: 'Repeat nomination',
        RECIPROCAL_NOMINATION: 'Possible reciprocal nomination'
    };

    let currentNominations = [];

    function formatDate(isoString) {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function showStatusMessage(text, type) {
        statusMessageEl.textContent = text;
        statusMessageEl.hidden = false;
        statusMessageEl.className = 'status-message status-message--' + type;
        window.clearTimeout(showStatusMessage._timer);
        showStatusMessage._timer = window.setTimeout(() => {
            statusMessageEl.hidden = true;
        }, 6000);
    }

    async function apiRequest(path, options) {
        const res = await fetch(API_BASE + path, options);
        let body = null;
        try { body = await res.json(); } catch (e) { /* no body */ }
        if (!res.ok) {
            const message = (body && body.error) || (body && JSON.stringify(body)) || ('Request failed (' + res.status + ')');
            throw new Error(message);
        }
        return body;
    }

    function populateFilterOptions(nominations) {
        const practices = [...new Set(nominations.map(n => n.practice))].sort();
        const locations = [...new Set(nominations.map(n => n.location))].sort();
        fillSelect(filterPractice, practices, 'All practices');
        fillSelect(filterLocation, locations, 'All locations');
    }

    function fillSelect(selectEl, values, allLabel) {
        const currentValue = selectEl.value;
        selectEl.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = allLabel;
        selectEl.appendChild(allOption);
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            selectEl.appendChild(opt);
        });
        if (values.includes(currentValue)) {
            selectEl.value = currentValue;
        }
    }

    function applyClientFilters(nominations) {
        return nominations.filter(n => {
            if (filterPractice.value && n.practice !== filterPractice.value) return false;
            if (filterLocation.value && n.location !== filterLocation.value) return false;
            return true;
        });
    }

    async function loadNominations() {
        listEl.innerHTML = '<p class="loading-state">Loading nominations…</p>';
        try {
            const statusParam = filterStatus.value ? ('?status=' + encodeURIComponent(filterStatus.value)) : '';
            const nominations = await apiRequest(statusParam, undefined);
            currentNominations = nominations;
            populateFilterOptions(nominations);
            renderList(applyClientFilters(nominations));
        } catch (err) {
            listEl.innerHTML = '';
            showStatusMessage('Couldn\u2019t load nominations: ' + err.message, 'error');
        }
    }

    function renderList(nominations) {
        listEl.innerHTML = '';
        countEl.textContent = nominations.length + (nominations.length === 1 ? ' nomination' : ' nominations');

        if (nominations.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = '<h2>Nothing here right now</h2><p>Nominations matching this filter will show up automatically.</p>';
            listEl.appendChild(empty);
            return;
        }

        nominations.forEach(n => listEl.appendChild(buildCard(n)));
    }

    function buildCard(nomination) {
        const node = template.content.cloneNode(true);
        const card = node.querySelector('.nomination-card');
        card.dataset.id = nomination.id;
        if (nomination.status === 'APPROVED') card.classList.add('is-approved');

        card.querySelector('.nominee-name').textContent = nomination.nomineeName;
        card.querySelector('.nominator-name').textContent = nomination.nominatorName;
        card.querySelector('.practice').textContent = nomination.practice;
        card.querySelector('.location').textContent = nomination.location;
        card.querySelector('.submitted-at').textContent = formatDate(nomination.submittedAt);
        card.querySelector('.what-text').textContent = nomination.whatText;
        card.querySelector('.how-text').textContent = nomination.howText;

        const pill = card.querySelector('.status-pill');
        pill.classList.add(STATUS_PILL_CLASS[nomination.status] || 'status-pill--pending');
        card.querySelector('.status-pill__text').textContent = STATUS_LABELS[nomination.status] || nomination.status;

        if (nomination.aiFlags && nomination.aiFlags.length > 0) {
            const flagsWrap = card.querySelector('.nomination-card__flags');
            flagsWrap.hidden = false;
            const list = card.querySelector('.flag-list');
            nomination.aiFlags.forEach(entry => {
                // Flags used to be bare enum strings; they now arrive as
                // {flag, label, source, reason}. Handle both so this page keeps
                // working against an older build of the API.
                const code = typeof entry === 'string' ? entry : entry.flag;
                const reason = typeof entry === 'string' ? null : entry.reason;
                const li = document.createElement('li');
                li.textContent = FLAG_LABELS[code] || (typeof entry === 'string' ? entry : entry.label);
                if (reason) {
                    li.title = reason;
                    const why = document.createElement('span');
                    why.className = 'flag-list__reason';
                    why.textContent = ' — ' + reason;
                    li.appendChild(why);
                }
                list.appendChild(li);
            });
        }

        if (nomination.aiEvaluationStatus === 'COMPLETED' && nomination.aiScore != null) {
            const assessment = card.querySelector('.nomination-card__ai-assessment');
            assessment.hidden = false;
            card.querySelector('.ai-assessment__score').textContent = 'Score: ' + nomination.aiScore + ' / 100';
            card.querySelector('.ai-assessment__rationale').textContent = nomination.aiRationale || '';
            const versionEl = card.querySelector('.ai-assessment__prompt-version');
            versionEl.textContent = nomination.aiPromptVersion ? '(' + nomination.aiPromptVersion + ')' : '';
        } else if (nomination.aiEvaluationStatus === 'FAILED' || nomination.aiEvaluationStatus === 'SKIPPED_NO_API_KEY') {
            card.querySelector('.nomination-card__ai-unavailable').hidden = false;
        }

        if (nomination.rejectionReason) {
            const info = card.querySelector('.nomination-card__decision-info');
            info.hidden = false;
            const label = nomination.status === 'NEEDS_RESUBMISSION' ? 'Feedback sent: ' : 'Reason: ';
            card.querySelector('.reason-text').textContent = label + nomination.rejectionReason;
        }

        const actionsWrap = card.querySelector('.nomination-card__actions');
        const reasonForm = card.querySelector('.reason-form');
        if (nomination.status !== 'PENDING_REVIEW') {
            actionsWrap.hidden = true;
        } else {
            wireActions(card, nomination, actionsWrap, reasonForm);
        }

        wireAuditHistory(card, nomination.id);

        return node;
    }

    function wireActions(card, nomination, actionsWrap, reasonForm) {
        const approveBtn = card.querySelector('[data-action="approve"]');
        const rejectBtn = card.querySelector('[data-action="reject"]');
        const resubmitBtn = card.querySelector('[data-action="request-resubmission"]');
        const cancelBtn = card.querySelector('.reason-form__cancel');
        const reasonLabel = card.querySelector('.reason-form__label');
        const reasonInput = card.querySelector('.reason-form__input');

        approveBtn.addEventListener('click', async () => {
            const email = promptForCoordinatorEmail();
            if (!email) return;
            setActionsDisabled(actionsWrap, true);
            try {
                await apiRequest('/' + nomination.id + '/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coordinatorEmail: email })
                });
                showStatusMessage('Nomination approved.', 'success');
                loadNominations();
            } catch (err) {
                showStatusMessage('Couldn\u2019t approve: ' + err.message, 'error');
                setActionsDisabled(actionsWrap, false);
            }
        });

        let pendingAction = null;

        rejectBtn.addEventListener('click', () => {
            pendingAction = 'reject';
            reasonLabel.textContent = 'Reason for rejection (sent to the nominator)';
            openReasonForm(actionsWrap, reasonForm, reasonInput);
        });

        resubmitBtn.addEventListener('click', () => {
            pendingAction = 'request-resubmission';
            reasonLabel.textContent = 'Feedback for the nominator (what needs to change)';
            openReasonForm(actionsWrap, reasonForm, reasonInput);
        });

        cancelBtn.addEventListener('click', () => {
            closeReasonForm(actionsWrap, reasonForm, reasonInput);
        });

        reasonForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reason = reasonInput.value.trim();
            if (!reason) return;
            const email = promptForCoordinatorEmail();
            if (!email) return;

            const submitBtn = reasonForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            try {
                await apiRequest('/' + nomination.id + '/' + pendingAction, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coordinatorEmail: email, reason })
                });
                showStatusMessage(
                    pendingAction === 'reject' ? 'Nomination rejected and nominator notified.' : 'Resubmission requested.',
                    'success'
                );
                loadNominations();
            } catch (err) {
                showStatusMessage('Couldn\u2019t submit: ' + err.message, 'error');
                submitBtn.disabled = false;
            }
        });
    }

    function openReasonForm(actionsWrap, reasonForm, reasonInput) {
        actionsWrap.hidden = true;
        reasonForm.hidden = false;
        reasonInput.value = '';
        reasonInput.focus();
    }

    function closeReasonForm(actionsWrap, reasonForm, reasonInput) {
        reasonForm.hidden = true;
        reasonInput.value = '';
        actionsWrap.hidden = false;
    }

    function setActionsDisabled(actionsWrap, disabled) {
        actionsWrap.querySelectorAll('button').forEach(b => { b.disabled = disabled; });
    }

    function promptForCoordinatorEmail() {
        // No auth wired up yet - this stands in for "the logged-in coordinator"
        // until Epic 3 gets real authentication.
        const stored = window.localStorage.getItem('reviewerEmail') || '';
        const email = window.prompt('Confirm your email to log this decision:', stored);
        if (email) window.localStorage.setItem('reviewerEmail', email);
        return email;
    }

    function wireAuditHistory(card, nominationId) {
        const details = card.querySelector('.audit-history');
        let loaded = false;
        details.addEventListener('toggle', async () => {
            if (!details.open || loaded) return;
            loaded = true;
            const content = details.querySelector('.audit-history__content');
            try {
                const entries = await apiRequest('/' + nominationId + '/audit-log', undefined);
                content.innerHTML = '';
                if (entries.length === 0) {
                    content.innerHTML = '<p class="audit-history__loading">No decisions recorded yet.</p>';
                    return;
                }
                entries.forEach(entry => {
                    const row = document.createElement('div');
                    row.className = 'audit-log-entry';
                    const time = document.createElement('span');
                    time.className = 'audit-log-entry__time';
                    time.textContent = formatDate(entry.occurredAt);
                    const text = document.createElement('span');
                    text.textContent = entry.coordinatorEmail + ' — ' + entry.action.replace('_', ' ')
                        + (entry.reason ? ': ' + entry.reason : '');
                    row.appendChild(time);
                    row.appendChild(text);
                    content.appendChild(row);
                });
            } catch (err) {
                content.innerHTML = '<p class="audit-history__loading">Couldn\u2019t load history.</p>';
            }
        });
    }

    filterStatus.addEventListener('change', loadNominations);
    filterPractice.addEventListener('change', () => renderList(applyClientFilters(currentNominations)));
    filterLocation.addEventListener('change', () => renderList(applyClientFilters(currentNominations)));
    refreshBtn.addEventListener('click', loadNominations);

    loadNominations();
})();
