import React, { useState, useEffect } from 'react';
import { Upload, FileUp, Download, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Colors,
} from 'chart.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Colors
);

const CHART_TYPES = {
  bar: 'Bar Graph',
  line: 'Line Chart',
  pie: 'Pie Chart',
  scatter: 'Scatter Plot',
  radar: 'Radar Chart',
  boxplot: 'Box Plot',
};

const DataUpload = () => {
  const [data, setData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const [chartConfig, setChartConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data && data.length > 0) {
      const availableColumns = Object.keys(data[0]);
      setColumns(availableColumns);
      // Initially select first two numeric columns if available
      const numericColumns = availableColumns.filter(col => 
        typeof data[0][col] === 'number'
      );
      setSelectedColumns(numericColumns.slice(0, 2));
    }
  }, [data]);

  useEffect(() => {
    if (data && selectedColumns.length > 0) {
      generateChart();
    }
  }, [selectedColumns, selectedChartType, data]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let parsedData;
        if (file.name.endsWith('.csv')) {
          parsedData = await parseCSV(e.target.result);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          parsedData = await parseExcel(e.target.result);
        } else if (file.name.endsWith('.json')) {
          parsedData = JSON.parse(e.target.result);
        }
        setData(parsedData);
      } catch (error) {
        console.error('Error parsing file:', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const parseCSV = (content) => {
    return new Promise((resolve) => {
      const lines = content.split('\n');
      const headers = lines[0].split(',');
      const result = [];
      
      for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const currentLine = lines[i].split(',');
        
        for (let j = 0; j < headers.length; j++) {
          const value = currentLine[j]?.trim();
          obj[headers[j].trim()] = isNaN(value) ? value : parseFloat(value);
        }
        result.push(obj);
      }
      
      resolve(result);
    });
  };

  const parseExcel = (content) => {
    const workbook = XLSX.read(content, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet);
  };

  const generateChart = () => {
    if (!data || !selectedColumns.length) return;

    setLoading(true);
    let config;

    switch (selectedChartType) {
      case 'bar':
        config = {
          type: 'bar',
          data: {
            labels: data.map((_, i) => `Entry ${i + 1}`),
            datasets: selectedColumns.map((col, i) => ({
              label: col,
              data: data.map(item => item[col]),
              backgroundColor: `hsla(${i * 360 / selectedColumns.length}, 70%, 50%, 0.5)`,
            }))
          }
        };
        break;

      case 'line':
        config = {
          type: 'line',
          data: {
            labels: data.map((_, i) => `Entry ${i + 1}`),
            datasets: selectedColumns.map((col, i) => ({
              label: col,
              data: data.map(item => item[col]),
              borderColor: `hsla(${i * 360 / selectedColumns.length}, 70%, 50%, 1)`,
              tension: 0.1
            }))
          }
        };
        break;

      case 'pie':
        const pieData = {};
        data.forEach(item => {
          const key = item[selectedColumns[0]];
          pieData[key] = (pieData[key] || 0) + 1;
        });

        config = {
          type: 'pie',
          data: {
            labels: Object.keys(pieData),
            datasets: [{
              data: Object.values(pieData),
            }]
          }
        };
        break;

      case 'scatter':
        if (selectedColumns.length >= 2) {
          config = {
            type: 'scatter',
            data: {
              datasets: [{
                label: `${selectedColumns[0]} vs ${selectedColumns[1]}`,
                data: data.map(item => ({
                  x: item[selectedColumns[0]],
                  y: item[selectedColumns[1]]
                }))
              }]
            }
          };
        }
        break;

      case 'radar':
        config = {
          type: 'radar',
          data: {
            labels: selectedColumns,
            datasets: [{
              label: 'Data Point',
              data: selectedColumns.map(col => data[0][col]),
              fill: true,
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgb(54, 162, 235)',
            }]
          }
        };
        break;

      case 'boxplot':
        const boxplotData = selectedColumns.map(col => {
          const values = data.map(item => item[col]).sort((a, b) => a - b);
          const q1 = values[Math.floor(values.length * 0.25)];
          const median = values[Math.floor(values.length * 0.5)];
          const q3 = values[Math.floor(values.length * 0.75)];
          const min = values[0];
          const max = values[values.length - 1];
          return { min, q1, median, q3, max };
        });

        config = {
          type: 'bar',
          data: {
            labels: ['Minimum', 'Q1', 'Median', 'Q3', 'Maximum'],
            datasets: boxplotData.map((stats, i) => ({
              label: selectedColumns[i],
              data: [stats.min, stats.q1, stats.median, stats.q3, stats.max],
              backgroundColor: `hsla(${i * 360 / selectedColumns.length}, 70%, 50%, 0.5)`,
            }))
          }
        };
        break;
    }

    setChartConfig(config);
    setLoading(false);
  };

  const downloadReport = async () => {
    if (!chartConfig) return;

    const pdf = new jsPDF();
    const chartsContainer = document.getElementById('chart-container');
    
    if (chartsContainer) {
      const canvas = await html2canvas(chartsContainer);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 10, 10, 190, 280);
      pdf.save('data-analysis-report.pdf');
    }
  };

  return (
    <section id="upload" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Start Analyzing Your Data
        </h2>
        <p className="text-xl text-gray-600 text-center mb-12">
          Upload your data file and generate comprehensive insights
        </p>

        <div className="max-w-xl mx-auto mb-8">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-blue-50">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-blue-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  CSV, JSON, XLS, XLSX
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv,.json,.xls,.xlsx"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        {data && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Chart Type
                </label>
                <select
                  value={selectedChartType}
                  onChange={(e) => setSelectedChartType(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  {Object.entries(CHART_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Columns
                </label>
                <select
                  multiple
                  value={selectedColumns}
                  onChange={(e) => setSelectedColumns(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full p-2 border rounded-lg"
                  size={4}
                >
                  {columns.map(column => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={generateChart}
                disabled={loading || !selectedColumns.length}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <FileUp className="mr-2 h-5 w-5" />
                Generate Report
              </button>
              <button
                onClick={downloadReport}
                disabled={!chartConfig || loading}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Report
              </button>
            </div>
          </div>
        )}

        {chartConfig && (
          <div id="chart-container" className="bg-white p-6 rounded-xl shadow-lg">
            <Chart 
              type={chartConfig.type} 
              data={chartConfig.data}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: CHART_TYPES[selectedChartType]
                  }
                }
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default DataUpload;