export function createKeyboard(buttons, options = {}) {
  return {
    inline_keyboard: buttons,
    ...options
  };
}