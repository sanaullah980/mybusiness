function appendConfirmation(text, onYes, onNo) {
  const box = aiMessages();
  if (!box) return;

  box.querySelector('.ai-empty')?.remove();

  const row = document.createElement('div');
  row.className = 'ai-message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'ai-message-bubble';

  const message = document.createElement('div');
  message.innerHTML = escAi(text).replace(/\n/g, '<br>');

  const actions = document.createElement('div');
  actions.className = 'ai-confirm-actions';

  const yesBtn = document.createElement('button');
  yesBtn.type = 'button';
  yesBtn.className = 'btn ai-confirm-yes';
  yesBtn.textContent = 'Yes';

  const noBtn = document.createElement('button');
  noBtn.type = 'button';
  noBtn.className = 'btn btn-secondary ai-confirm-no';
  noBtn.textContent = 'No';

  actions.appendChild(yesBtn);
  actions.appendChild(noBtn);

  bubble.appendChild(message);
  bubble.appendChild(actions);
  row.appendChild(bubble);
  box.appendChild(row);

  box.scrollTop = box.scrollHeight;

  yesBtn.onclick = async () => {
    yesBtn.disabled = true;
    noBtn.disabled = true;
    await onYes?.();
  };

  noBtn.onclick = async () => {
    yesBtn.disabled = true;
    noBtn.disabled = true;
    await onNo?.();
  };
}