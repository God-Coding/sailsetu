# SailPoint Connector - Standalone Deployment

This is a standalone deployment package of the SailPoint Connector application. It includes all necessary dependencies and can be run independently without requiring the full development environment.

## Quick Start

### Prerequisites
- **Node.js 18+** (will be auto-installed if missing)

### Running the Application

1. **Double-click** `start_app.bat` to launch the application
   - The script will check for Node.js and install it if needed
   - The server will start on port 3000

2. **Access the application** at: `http://localhost:3000`

## Manual Start

If you prefer to start the server manually:

```bash
node server.js
```

## Configuration

### Environment Variables

Edit the `.env` file to configure:
- Azure OpenAI endpoint and API key
- Deployment model
- API version

### Port Configuration

The default port is 3000. To change it, edit `start_app.bat` and modify:
```batch
set PORT=3000
```

Or set the PORT environment variable before running:
```bash
set PORT=8080
node server.js
```

## Features

This standalone deployment includes all features from the main SailPoint Connector:

- **Dashboard** - Central hub for all tools
- **Rule Runner** - Execute SailPoint rules with XML editor
- **Workflow Access** - Launch and manage workflows
- **Application Cloner** - Duplicate applications via SCIM API
- **Batch Operations** - Bulk identity operations
- **Certification Reports** - Generate access certification reports
- **AI Reports** - AI-powered reporting and analysis
- **Product Customization** - Custom XML object management
- **Request Maintenance** - Manage access requests
- **Leaver Cleanup** - Automated identity cleanup
- **Firefighter Access** - Emergency access management
- **Workgroup Management** - Manage workgroups
- **Code Visualizer** - Visualize XML workflows and rules
- **Profile Management** - User profile operations
- **XML Comparison** - Compare XML configurations

## Troubleshooting

### Server Won't Start
- Ensure Node.js 18+ is installed: `node -v`
- Check if port 3000 is already in use
- Verify `.env` file exists and is properly configured

### Cannot Connect to IdentityIQ
- Ensure IdentityIQ is running (typically at `http://localhost:8080/identityiq`)
- Check network connectivity
- Verify credentials in the application

### Missing Features
- This build was created on: ${new Date().toISOString().split('T')[0]}
- If features are missing, rebuild from the main project

## Updating the Standalone Build

To update with the latest code from the main project:

1. Navigate to the main project directory
2. Ensure `next.config.ts` has `output: 'standalone'`
3. Run `npm run build`
4. Copy `.next/standalone/*` to this directory
5. Copy `public/` folder
6. Copy `.next/static/` to `.next/static/`
7. Copy `.env` file

## Support

For issues or questions, refer to the main project documentation.

---

**Build Date**: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })}  
**Version**: Standalone Build
