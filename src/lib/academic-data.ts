export type Situacao = "aprovado" | "recuperacao" | "reprovado";

export type Disciplina = {
  nome: string;
  nota: number;
  faltas: number;
};

export type Aluno = {
  id: string;
  nome: string;
  matricula: string;
  turma: string;
  frequencia: number;
  disciplinas: Disciplina[];
  bimestres: number[];
};

export const media = (aluno: Aluno) =>
  aluno.disciplinas.reduce((t, d) => t + d.nota, 0) / aluno.disciplinas.length;

export const situacaoDe = (aluno: Aluno): Situacao => {
  const m = media(aluno);
  if (m < 5 || aluno.frequencia < 70) return "reprovado";
  if (m < 7 || aluno.frequencia < 80) return "recuperacao";
  return "aprovado";
};

export const rotuloSituacao: Record<Situacao, string> = {
  aprovado: "Aprovado",
  recuperacao: "Recuperação",
  reprovado: "Reprovado",
};

const d = (nome: string, nota: number, faltas: number): Disciplina => ({ nome, nota, faltas });

export const alunos: Aluno[] = [
  {
    id: "1",
    nome: "Ana Beatriz Rocha",
    matricula: "2024.0148",
    turma: "9º A",
    frequencia: 98,
    disciplinas: [d("Matemática", 9.2, 1), d("Português", 9.0, 0), d("Ciências", 8.8, 2), d("História", 9.4, 1)],
    bimestres: [8.6, 8.9, 9.1, 9.1],
  },
  {
    id: "2",
    nome: "Léo Martins Vieira",
    matricula: "2024.0091",
    turma: "9º B",
    frequencia: 91,
    disciplinas: [d("Matemática", 7.8, 3), d("Português", 8.6, 2), d("Ciências", 8.1, 4), d("História", 8.3, 1)],
    bimestres: [7.2, 7.8, 8.0, 8.2],
  },
  {
    id: "3",
    nome: "Marina Duarte Alves",
    matricula: "2024.0203",
    turma: "9º B",
    frequencia: 84,
    disciplinas: [d("Matemática", 5.8, 6), d("Português", 8.4, 2), d("Ciências", 6.1, 5), d("História", 6.9, 3)],
    bimestres: [6.9, 6.5, 6.6, 6.8],
  },
  {
    id: "4",
    nome: "Rafael Nunes Prado",
    matricula: "2024.0177",
    turma: "8º A",
    frequencia: 72,
    disciplinas: [d("Matemática", 4.2, 12), d("Português", 5.6, 9), d("Ciências", 4.9, 11), d("História", 5.1, 8)],
    bimestres: [5.8, 5.2, 4.9, 4.9],
  },
  {
    id: "5",
    nome: "Camila Souza Lima",
    matricula: "2024.0112",
    turma: "8º C",
    frequencia: 95,
    disciplinas: [d("Matemática", 7.4, 2), d("Português", 8.2, 1), d("Ciências", 7.9, 3), d("História", 7.3, 2)],
    bimestres: [7.0, 7.4, 7.6, 7.7],
  },
  {
    id: "6",
    nome: "Bruno Cardoso Reis",
    matricula: "2024.0056",
    turma: "8º B",
    frequencia: 80,
    disciplinas: [d("Matemática", 5.1, 7), d("Português", 6.2, 5), d("Ciências", 5.4, 6), d("História", 5.9, 4)],
    bimestres: [6.1, 5.8, 5.6, 5.7],
  },
  {
    id: "7",
    nome: "Helena Pacheco Dias",
    matricula: "2024.0224",
    turma: "9º A",
    frequencia: 97,
    disciplinas: [d("Matemática", 8.9, 1), d("Português", 9.3, 0), d("Ciências", 8.4, 1), d("História", 8.8, 2)],
    bimestres: [8.2, 8.5, 8.8, 8.9],
  },
  {
    id: "8",
    nome: "Igor Fontes Barbosa",
    matricula: "2024.0130",
    turma: "8º A",
    frequencia: 88,
    disciplinas: [d("Matemática", 6.4, 4), d("Português", 7.1, 3), d("Ciências", 6.8, 3), d("História", 7.5, 2)],
    bimestres: [6.4, 6.7, 6.9, 7.0],
  },
];

export const bimestresTurma = [0, 1, 2, 3].map((i) => ({
  rotulo: `${i + 1}º bim.`,
  valor: alunos.reduce((t, a) => t + (a.bimestres[i] ?? 0), 0) / alunos.length,
}));
