import {genkit} from 'genkit';
import {openai} from 'genkitx-openai';

export const ai = genkit({
  plugins: [openai()],
  model: 'openai/gpt-4o',
});
