/**
 * ハーマンモデル分析アプリ (Herrmann Model Analysis App)
 *
 * 【概要】
 * ユーザーが52の質問に対して「0, 2, 5」の点数で回答し、その結果から
 * ハーマンモデルの4象限（A: 論理・理性, B: 堅実・計画, C: 感覚・友好, D: 冒険・創造）
 * のスコアを算出してレーダーチャートで可視化します。
 * さらに、Google Gemini APIを使用して、スコアに基づいた個人の強みや適職などの
 * 詳細な分析結果を生成・表示します。
 *
 * 【主な機能】
 * - 52問の質問への回答入力（リアルタイムでのスコア・チャート更新）
 * - Gemini APIによるパーソナライズされた分析結果の生成
 * - 分析結果のPDFダウンロード機能
 * - 回答結果のCSVダウンロード機能
 */
import React, { useState, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Download, Info, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const quadrantColors = {
  'A (論理・理性)': '#3b82f6',
  'B (堅実・計画)': '#22c55e',
  'C (感覚・友好)': '#ef4444',
  'D (冒険・創造)': '#eab308',
};

type Question = {
  id: number;
  text: string;
  quadrant: 'A' | 'B' | 'C' | 'D';
  examples: string;
};

const questions: Question[] = [
  { id: 1, text: '一人でもくもくと取り組む', quadrant: 'A', examples: 'データ入力、プログラミング、翻訳、商品の検品・仕分け、校正作業' },
  { id: 2, text: '法則や方法論を学び、活用する', quadrant: 'A', examples: '法律やルールの確認、技術マニュアルの読解・適用、エンジニアリング' },
  { id: 3, text: '完成するまで、きちんと丁寧にやる', quadrant: 'A', examples: '事務処理の完遂、部品の精密な組み立て、図面の作成、校閲、設計' },
  { id: 4, text: 'データや統計数値を分析する', quadrant: 'A', examples: '売上の集計・分析、アンケート結果の処理、市場調査データの読み取り' },
  { id: 5, text: '情報をわかりやすく整理する', quadrant: 'A', examples: '共有フォルダの整理、WikiやFAQの更新、データベースの保守' },
  { id: 6, text: 'ものごとが上手くいくように関わる', quadrant: 'A', examples: '事務代行、調整業務、他部署へのフォロー、備品管理' },
  { id: 7, text: '難しい問題を解決する', quadrant: 'A', examples: 'システムのトラブルシューティング、クレーム対応の検討、経営改善案の立案' },
  { id: 8, text: 'データや統計数値から、仮説を立てる', quadrant: 'A', examples: 'プロモーション効果の予測、需要予測、新商品のコンセプト立案、改善策立案' },
  { id: 9, text: '他者から挑戦を受ける', quadrant: 'A', examples: '競合他社とのコンペ、価格交渉、デバッグ作業（エラー探し）' },
  { id: 10, text: '事実を分析・診断をする', quadrant: 'A', examples: '機器の故障診断、内部監査、プログラムのコードレビュー' },
  { id: 11, text: '物事を説明する', quadrant: 'A', examples: '操作説明の実施、マニュアルの解説、社内レクチャーの講師' },
  { id: 12, text: '論点をはっきりさせる', quadrant: 'A', examples: '議事録の要約、会議のファシリテーション、争点の整理' },
  { id: 13, text: '論理的に考え、対処する', quadrant: 'A', examples: 'セキュリティ対策の実施、システム要件の定義、クレーム対応' },
  { id: 14, text: '物事を組み立てる', quadrant: 'B', examples: '工期・スケジュールの作成、作業手順書の作成' },
  { id: 15, text: '全体像を把握する', quadrant: 'B', examples: '事業計画の作成、プロジェクト全体のロードマップ管理' },
  { id: 16, text: 'ルール・規律が整っている環境にいる', quadrant: 'B', examples: '公的書類の審査、窓口業務、銀行などの定型的な事務作業' },
  { id: 17, text: '現状を維持する', quadrant: 'B', examples: '設備の定期保守、サーバーの監視業務、ルーチンワークの継続' },
  { id: 18, text: '書類作成・整理', quadrant: 'B', examples: '契約書の作成、経理伝票の処理、請求書の発行、ファイリング' },
  { id: 19, text: 'ルール・規則を作る', quadrant: 'B', examples: '就業規則の起案、セキュリティポリシーの策定、コーディング規約の作成' },
  { id: 20, text: '計画をしてから、行動する', quadrant: 'B', examples: 'イベントの工程表作成、予算計画の策定、旅行の行程作成' },
  { id: 21, text: '組織や物事を安定させる', quadrant: 'B', examples: '内部統制の管理、リスクヘッジ策の実行、資産運用の管理' },
  { id: 22, text: '時間通りに物事を進める', quadrant: 'B', examples: '配送管理、イベントの進行管理（タイムキーパー）、納期管理' },
  { id: 23, text: '細かい部分にも気を遣う', quadrant: 'B', examples: 'はんだ付け、薬剤の調剤、誤字脱字のチェック、精密機器の検査' },
  { id: 24, text: '体系化され順序立った仕事をする', quadrant: 'B', examples: 'データベース設計、仕訳作業、法的手続きの進捗管理' },
  { id: 25, text: '引っ張るより、フォローする', quadrant: 'B', examples: '営業アシスタント、秘書、カスタマーサポート（後方支援）' },
  { id: 26, text: '管理して、きちんと進むようにする', quadrant: 'B', examples: '進捗確認、納期の管理、PMO（プロジェクト管理支援）業務' },
  { id: 27, text: 'リスクを取る', quadrant: 'D', examples: '新規事業への投資判断、未経験分野への挑戦、デイトレード' },
  { id: 28, text: '解決策を生み出す（開発する）', quadrant: 'D', examples: 'プロトタイプの制作、新機能の設計、トラブルの根本原因究明' },
  { id: 29, text: 'ビジョンを描き、共有する', quadrant: 'D', examples: '中長期計画の策定、ブランドコンセプトの構築、プレゼン資料作成' },
  { id: 30, text: '多様な意見を取り入れる', quadrant: 'D', examples: 'ブレインストーミングの主催、アンケート調査の実施、ワークショップ（研修）運営' },
  { id: 31, text: '変化を起こす', quadrant: 'D', examples: '組織改革の提案、業務フローの刷新、DXの推進' },
  { id: 32, text: '取りあえず、やってみる（実験する）', quadrant: 'D', examples: '試作品のユーザーテスト、小規模な実証実験' },
  { id: 33, text: 'アイデアを生み出す', quadrant: 'D', examples: '企画立案、ネーミング考案、コピーライティング' },
  { id: 34, text: '新しいことを始める', quadrant: 'D', examples: 'スタートアップの立ち上げ、新規プロジェクトの発足、新サービスの導入' },
  { id: 35, text: 'デザイン・設計する', quadrant: 'D', examples: 'UI/UXデザイン、ロゴ制作、建築設計、インテリアコーディネート' },
  { id: 36, text: '広いスペース・空間で仕事をする', quadrant: 'D', examples: 'フィールドワーク、店舗レイアウトの設計、イベント会場の設営' },
  { id: 37, text: '自由にする', quadrant: 'D', examples: 'フリーランス活動、裁量労働制での業務、クリエイティブな創作活動' },
  { id: 38, text: 'はじめに結果を予想する', quadrant: 'D', examples: '市場動向の予測、シミュレーション実行' },
  { id: 39, text: '興奮することを仕事にする', quadrant: 'D', examples: 'エンターテインメント企画、イベントプロデュース' },
  { id: 40, text: 'チームが上手くいくように関わる', quadrant: 'C', examples: 'チームビルディングの実施、メンタルケア、社内レクリエーション企画' },
  { id: 41, text: '自分の考えを伝える', quadrant: 'C', examples: 'スピーチ、広報活動、エッセイ執筆、プレゼンテーション' },
  { id: 42, text: '良好な関係を築く', quadrant: 'C', examples: 'ネットワーク構築、顧客訪問（御用聞き）、接待・会食の調整' },
  { id: 43, text: '教育やトレーニングに関心がある', quadrant: 'C', examples: '社内研修の講師、教育用マニュアル作成、OJTの実施' },
  { id: 44, text: '人の話を共感を示しながら、しっかり聞く', quadrant: 'C', examples: 'キャリアカウンセリング、インタビュー、クレームの傾聴' },
  { id: 45, text: 'チームで協力し合う', quadrant: 'C', examples: '共同プロジェクトの推進、ナレッジ共有、グループワーク' },
  { id: 46, text: '人を説得する', quadrant: 'C', examples: '営業交渉、資金調達のピッチ、合意形成の取りまとめ' },
  { id: 47, text: 'チームの一員として働く', quadrant: 'C', examples: 'グループワーク、分担作業の遂行、事務サポート' },
  { id: 48, text: '人とのコミュニケーションを大事にする', quadrant: 'C', examples: '受付業務、お客様まわり、コミュニティの形成' },
  { id: 49, text: '困っている人を助ける', quadrant: 'C', examples: 'ボランティア活動、カスタマーサポート、テクニカルサポート' },
  { id: 50, text: '表現豊かな文章を書く', quadrant: 'C', examples: 'ブログ執筆、小説の創作、広報記事の作成' },
  { id: 51, text: '人の目標達成を支援する', quadrant: 'C', examples: 'コーチング、コンサルティング、メンター業務' },
  { id: 52, text: '人の悩みを聞き、心を癒す', quadrant: 'C', examples: 'セラピー、カウンセリング、癒やし系サービスの提供' },
];

const CustomTick = ({ payload, x, y, textAnchor }: any) => {
  const parts = payload.value.split(' ');
  const letter = parts[0];
  const desc = parts[1] || '';

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={quadrantColors[payload.value as keyof typeof quadrantColors]}
      fontSize={12}
      fontWeight="bold"
    >
      <tspan x={x} dy="-0.2em">{letter}</tspan>
      <tspan x={x} dy="1.2em">{desc}</tspan>
    </text>
  );
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = quadrantColors[payload.subject as keyof typeof quadrantColors];
  return (
    <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />
  );
};

export default function App() {
  // --- State Management ---
  // 画面の表示状態（'questions': 質問画面, 'results': 分析結果画面）
  const [view, setView] = useState<'questions' | 'results'>('questions');
  // ユーザーの回答データ（キー: 質問ID, 値: 選択された点数 0, 2, 5）
  const [answers, setAnswers] = useState<Record<number, 0 | 2 | 5>>({});
  // 各象限（A, B, C, D）の合計スコア
  const [scores, setScores] = useState({ A: 0, B: 0, C: 0, D: 0 });
  // Gemini APIから返却されたMarkdown形式の分析結果
  const [analysis, setAnalysis] = useState<string | null>(null);
  // AI分析中のローディング状態
  const [loading, setLoading] = useState(false);
  // PDF生成中のローディング状態
  const [isDownloading, setIsDownloading] = useState(false);
  // 分析開始前の確認モーダルの表示状態
  const [showConfirm, setShowConfirm] = useState(false);
  
  // PDF出力用のDOM要素を参照するためのRef
  const reportRef = useRef<HTMLDivElement>(null);

  /**
   * 結果画面をPDFとしてダウンロードする関数
   * html-to-imageでDOMを画像化し、jsPDFでPDF化して保存します。
   */
  const downloadPDF = async () => {
    // If opened in a new tab, use the browser's native print (best quality, perfect page breaks)
    if (window.self === window.top) {
      window.print();
      return;
    }

    // Fallback for iframe (AI Studio preview)
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#f9fafb',
        filter: (node) => {
          if (node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore')) {
            return false;
          }
          return true;
        }
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add 15mm margin
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (reportRef.current.offsetHeight * contentWidth) / reportRef.current.offsetWidth;

      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      pdf.save('herrmann-analysis-result.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * 質問の回答が変更されたときの処理
   * 回答状態を更新し、同時に各象限の合計スコアを再計算します。
   */
  const handleAnswerChange = (questionId: number, score: 0 | 2 | 5) => {
    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: score };
      const newScores = { A: 0, B: 0, C: 0, D: 0 };
      questions.forEach(q => {
        newScores[q.quadrant] += newAnswers[q.id] || 0;
      });
      setScores(newScores);
      return newAnswers;
    });
  };

  /**
   * 回答結果をCSV形式でダウンロードする関数
   * Excelでの文字化けを防ぐため、BOM付きのUTF-8で出力します。
   */
  const downloadCSV = () => {
    const headers = ['No', '仕事・取組み', '象限', '点数', '具体的な作業名（参考）'];
    const rows = questions.map(q => {
      const score = answers[q.id] || 0;
      const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
      return [
        q.id,
        escapeCSV(q.text),
        q.quadrant,
        score,
        escapeCSV(q.examples)
      ].join(',');
    });

    // Add BOM for Excel compatibility in Japanese
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'herrmann-answers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateScores = () => {
    const newScores = { A: 0, B: 0, C: 0, D: 0 };
    questions.forEach(q => {
      const score = answers[q.id] || 0;
      newScores[q.quadrant] += score;
    });
    setScores(newScores);
    return newScores;
  };

  /**
   * 確認モーダルで「はい」が押されたときの処理
   * モーダルを閉じ、結果画面へ遷移してAI分析を開始します。
   */
  const handleConfirmAnalysis = () => {
    setShowConfirm(false);
    setView('results');
    generateAnalysis(scores);
  };

  /**
   * Gemini APIを使用して分析結果を生成する関数
   * @param currentScores 各象限の合計スコア
   */
  const generateAnalysis = async (currentScores: { A: number, B: number, C: number, D: number }) => {
    setLoading(true);
    try {
      const examplesA = questions.filter(q => q.quadrant === 'A').map(q => q.examples).join('、');
      const examplesB = questions.filter(q => q.quadrant === 'B').map(q => q.examples).join('、');
      const examplesC = questions.filter(q => q.quadrant === 'C').map(q => q.examples).join('、');
      const examplesD = questions.filter(q => q.quadrant === 'D').map(q => q.examples).join('、');

      const prompt = `
ハーマンモデルのABCDの点数が以下のように入力されました。
A（論理・理性）：${currentScores.A}点
B（堅実・計画）：${currentScores.B}点
C（感覚・友好）：${currentScores.C}点
D（冒険・創造）：${currentScores.D}点

【具体的な作業名の参考リスト（象限別）】
A象限の作業：${examplesA}
B象限の作業：${examplesB}
C象限の作業：${examplesC}
D象限の作業：${examplesD}

この点数に基づいて、以下の項目について詳細に分析・解説してください。
出力はMarkdown形式で、以下の指示とフォーマットに**必ず**従ってください。

<br>

## 1. 結果に見えるABCDの傾向
※以下の見出しで**テーブル（表）形式**で表示してください。
| 象限 | テーマ | 点数 | 傾向・特徴 |
|---|---|---|---|

<br>

### 全体的な人物像
※ここに全体的な人物像の解説を記述してください。

<br>

## 2. 力が発揮されやすい（＝得意）仕事の具体的な作業
※以下の見出しで**テーブル（表）形式**で表示してください。
※「具体的な作業名」は、必ず上記の【具体的な作業名の参考リスト】から、この人物の得意な象限に合致するものを引用して記載してください。
| 具体的な作業名 | 活かされる象限 | 詳細な解説 |
|---|---|---|

<br>

## 3. ストレスを感じやすい仕事の具体的な作業
※以下の見出しで**テーブル（表）形式**で表示してください。
※「具体的な作業名」は、必ず上記の【具体的な作業名の参考リスト】から、この人物の苦手な（点数が低い）象限に合致するものを引用して記載してください。
| 具体的な作業名 | 関連する象限 | 詳細な解説 |
|---|---|---|

<br>

## 4. ハーマンモデルから見える得意が発揮されやすい仕事（職種や役割）
※以下の見出しで**テーブル（表）形式**で表示してください。
| 職種・役割 | 適性の理由・解説 |
|---|---|
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setAnalysis(response.text || "分析結果を取得できませんでした。");
    } catch (error: any) {
      console.error("Error generating analysis:", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429')) {
        setAnalysis("### ⚠️ APIの利用制限（クォータ）に達しました\n\n現在、AIへのリクエストが上限に達しているため分析を実行できません。しばらく時間をおいてから再度お試しください。");
      } else {
        setAnalysis("### ⚠️ エラーが発生しました\n\n分析の生成中にエラーが発生しました。もう一度お試しください。\n\n詳細: " + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const chartData = [
    { subject: 'A (論理・理性)', A: scores.A, fullMark: 65 },
    { subject: 'D (冒険・創造)', A: scores.D, fullMark: 65 },
    { subject: 'C (感覚・友好)', A: scores.C, fullMark: 65 },
    { subject: 'B (堅実・計画)', A: scores.B, fullMark: 65 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8" ref={reportRef}>
        <header className="text-center print:mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ハーマンモデル分析アプリ</h1>
          <p className="text-gray-600 mt-2">※この診断結果はハーマンモデルの理論に基づく傾向分析であり、個人の可能性を限定するものではありません。</p>
          <p className="text-gray-600 mt-1 text-sm">
            ※AI分析に関しては、Geminiを使用しています。<br />
            　分析結果は「AIによる回答であり、参考のための活用」としてください
          </p>
        </header>

        {view === 'questions' ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">質問に回答してください</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-3 font-semibold text-gray-700 whitespace-nowrap">No</th>
                    <th className="border p-3 font-semibold text-gray-700 whitespace-nowrap">仕事・取組み</th>
                    <th className="border p-3 font-semibold text-gray-700 whitespace-nowrap text-center">象限</th>
                    <th className="border p-3 font-semibold text-gray-700 whitespace-nowrap text-center">点数</th>
                    <th className="border p-3 font-semibold text-gray-700 whitespace-nowrap">具体的な作業名（参考）</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="border p-3 text-gray-600 text-center">{q.id}</td>
                      <td className="border p-3 text-gray-800 font-medium">{q.text}</td>
                      <td className="border p-3 text-gray-500 text-center">{q.quadrant}</td>
                      <td className="border p-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          {[0, 2, 5].map((score) => (
                            <label key={score} className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                value={score}
                                checked={answers[q.id] === score}
                                onChange={() => handleAnswerChange(q.id, score as 0 | 2 | 5)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="text-gray-700">{score}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="border p-3 text-sm text-gray-600">{q.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Score Summary Section (Live) */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">現在のスコア</h2>
                <div className="space-y-4">
                  {Object.entries(scores).map(([quadrant, score]) => (
                    <div key={quadrant} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <span className="font-medium text-gray-700">
                        象限 {quadrant}
                        <span className="text-xs text-gray-500 ml-2">
                          {quadrant === 'A' && '(論理・理性)'}
                          {quadrant === 'B' && '(堅実・計画)'}
                          {quadrant === 'C' && '(感覚・友好)'}
                          {quadrant === 'D' && '(冒険・創造)'}
                        </span>
                      </span>
                      <span className="text-lg font-bold text-blue-600">{score} 点</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Section (Live) */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 self-start">レーダーチャート</h2>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={<CustomTick />} />
                      <PolarRadiusAxis angle={30} domain={[0, 65]} />
                      <Radar name="Score" dataKey="A" stroke="#9ca3af" fill="#f3f4f6" fillOpacity={0.8} dot={<CustomDot />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setShowConfirm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                AIで分析する
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 print:hidden" data-html2canvas-ignore="true">
              <button
                onClick={() => setView('questions')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                質問画面に戻る
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:flex print:flex-row">
              {/* Score Summary Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:w-1/2 print:shadow-none print:border-gray-300">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">スコア結果</h2>
                <div className="space-y-4">
                  {Object.entries(scores).map(([quadrant, score]) => (
                    <div key={quadrant} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <span className="font-medium text-gray-700">
                        象限 {quadrant}
                        <span className="text-xs text-gray-500 ml-2">
                          {quadrant === 'A' && '(論理・理性)'}
                          {quadrant === 'B' && '(堅実・計画)'}
                          {quadrant === 'C' && '(感覚・友好)'}
                          {quadrant === 'D' && '(冒険・創造)'}
                        </span>
                      </span>
                      <span className="text-lg font-bold text-blue-600">{score} 点</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center print:w-1/2 print:shadow-none print:border-gray-300">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 self-start">レーダーチャート</h2>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" tick={<CustomTick />} />
                      <PolarRadiusAxis angle={30} domain={[0, 65]} />
                      <Radar name="Score" dataKey="A" stroke="#9ca3af" fill="#f3f4f6" fillOpacity={0.8} dot={<CustomDot />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Explanation Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:shadow-none print:border-gray-300 print:break-inside-avoid">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">ハーマンモデルの4つの象限</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h3 className="font-bold text-blue-800 mb-2">A象限：論理・理性（青）</h3>
                  <p className="text-sm text-blue-900">事実に基づき、論理的・分析的に物事を捉える思考。定量的なデータや合理性を重視します。</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <h3 className="font-bold text-yellow-800 mb-2">D象限：冒険・創造（黄）</h3>
                  <p className="text-sm text-yellow-900">全体像を捉え、革新的でクリエイティブな発想をする思考。ビジョンや変化、新しいアイデアを重視します。</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <h3 className="font-bold text-green-800 mb-2">B象限：堅実・計画（緑）</h3>
                  <p className="text-sm text-green-900">計画的で詳細にこだわり、順序立てて物事を進める思考。ルールや手順、安全性を重視します。</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                  <h3 className="font-bold text-red-800 mb-2">C象限：感覚・友好（赤）</h3>
                  <p className="text-sm text-red-900">人間関係や感情を大切にし、直感的に物事を捉える思考。コミュニケーションやチームワークを重視します。</p>
                </div>
              </div>
            </div>

            {/* Analysis Result Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:shadow-none print:border-gray-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b pb-4 gap-4 print:border-b-2 print:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-800">分析結果</h2>
                <div className="flex flex-col items-end gap-2" data-html2canvas-ignore="true">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={downloadCSV}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors print:hidden"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      回答をCSVで保存
                    </button>
                    <button
                      onClick={downloadPDF}
                      disabled={isDownloading || loading}
                      className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 print:hidden"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isDownloading ? 'PDF生成中...' : '結果をPDFで保存'}
                    </button>
                  </div>
                  {window.self !== window.top && (
                    <div className="flex items-start gap-1 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 max-w-xs">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>プレビュー画面では簡易PDFになります。文字切れを防ぐ綺麗なPDFを保存するには、右上の「新しいタブで開く」からアプリを開いてください。</p>
                    </div>
                  )}
                </div>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600">AIが分析結果を生成しています...</p>
                </div>
              ) : analysis ? (
                <div className="prose prose-blue max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600 prose-table:w-full prose-table:border-collapse prose-table:my-8 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-5 [&_th]:text-left [&_th]:whitespace-nowrap [&_td]:border [&_td]:border-gray-300 [&_td]:p-5 [&_td]:align-top [&_td:first-child]:whitespace-nowrap [&_tr]:print:break-inside-avoid">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {analysis}
                  </Markdown>
                </div>
              ) : null}
            </div>
          </>
        )}

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-html2canvas-ignore="true">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">確認</h3>
              <p className="text-gray-600 mb-6">分析を開始していいですか？</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  いいえ
                </button>
                <button
                  onClick={handleConfirmAnalysis}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  はい
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

