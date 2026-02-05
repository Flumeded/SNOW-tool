# ServiceNow Case Tracker

A tool to track your ServiceNow cases, monitor SLAs, and receive desktop notifications for urgent items.

## Features

- **CSV Upload**: Drag-and-drop CSV files exported from ServiceNow
- **SLA Monitoring**: Visual indicators (red/yellow/green) for SLA status
- **Desktop Notifications**: Get alerted when cases become critical
- **Statistics**: Track daily locked/resolved cases and 7-day trends
- **Filtering**: Filter cases by state, priority, or SLA status

## Prerequisites

- Python 3.8+
- Node.js 18+ (for the frontend)

## Quick Start

### 1. Install Backend Dependencies

```bash
cd backend
pip3 install -r requirements.txt
```

### 2. Start the Backend

```bash
cd backend
python3 run.py
```

The API will be available at http://localhost:5000

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Start the Frontend

```bash
cd frontend
npm run dev
```

The dashboard will be available at http://localhost:5173

## Usage

1. Export your case list from ServiceNow as CSV
2. Open the dashboard at http://localhost:5173
3. Drag and drop the CSV file onto the upload zone
4. View your cases with SLA indicators
5. Configure thresholds in Settings

## CSV Format

The tool expects these columns from ServiceNow:

| Column | Description |
|--------|-------------|
| `number` | Case number (required) |
| `short_description` | Case title |
| `u_time_to_respond` | Response time |
| `ref_sn_customerservice_technical_case.u_sla_time_left` | SLA time remaining |
| `u_sub_state` | Case state |
| `u_region` | Region |
| `priority` | Priority level |
| `sys_updated_on` | Last update timestamp |

## SLA Thresholds (Default)

- **Critical (Red)**: < 30 minutes remaining
- **Warning (Yellow)**: < 2 hours remaining
- **OK (Green)**: > 2 hours remaining

Configure these in the Settings modal.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload CSV file |
| `/api/cases` | GET | List all cases |
| `/api/cases/urgent` | GET | Get urgent cases |
| `/api/stats/overview` | GET | Dashboard statistics |
| `/api/stats/daily` | GET | Today's activity |
| `/api/stats/trend` | GET | 7-day trend |
| `/api/settings` | GET/PUT | User settings |
| `/api/health` | GET | Health check |

## Project Structure

```
snow-tracker/
├── backend/
│   ├── app/
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   ├── routes/      # API endpoints
│   │   └── utils/       # Helper functions
│   ├── requirements.txt
│   └── run.py           # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   └── services/    # API client
│   └── package.json
└── sample_data.csv      # Test data
```

## Future Enhancements

- Chrome extension for automatic CSV export
- Email/Slack notifications
- Team dashboards
- Historical SLA charts
# SNOW-tool
