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

export const alunos: Aluno[] = [];

export const bimestresTurma = [0, 1, 2, 3].map((i) => ({
  rotulo: `${i + 1}º bim.`,
  valor: alunos.length === 0 ? 0 : alunos.reduce((t, a) => t + (a.bimestres[i] ?? 0), 0) / alunos.length,
}));
