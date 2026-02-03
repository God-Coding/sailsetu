import { NextResponse } from 'next/server';
import waInstance from '@/lib/whatsapp/client';
import tgInstance from '@/lib/telegram/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    // Return status or stream QR?
    // Let's implement Server-Sent Events (SSE) for real-time QR updates

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'status') {
        const { status, qrCode, hasConfig } = waInstance.getStatus();
        return NextResponse.json({ status, qrCode, hasConfig });
    }

    if (mode === 'stream') {
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            start(controller) {
                // Send initial status
                const sendUpdate = () => {
                    const data = JSON.stringify(waInstance.getStatus());
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                };

                sendUpdate();

                // Listen for updates
                const onQr = () => sendUpdate();
                const onReady = () => sendUpdate();
                const onDisconnected = () => sendUpdate();

                waInstance.on('qr', onQr);
                waInstance.on('ready', onReady);
                waInstance.on('disconnected', onDisconnected);

                // Cleanup
                req.signal.addEventListener('abort', () => {
                    waInstance.off('qr', onQr);
                    waInstance.off('ready', onReady);
                    waInstance.off('disconnected', onDisconnected);
                    controller.close();
                });
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    return NextResponse.json({ message: "Invalid mode" }, { status: 400 });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, config } = body;

        if (action === 'update_config') {
            waInstance.setSailPointConfig(config);
            // telegramToken is passed inside config or alongside it in the Dashboard POST
            tgInstance.setConfig(config, body.telegramToken);
            return NextResponse.json({ success: true, message: "Configuration updated" });
        }

        if (action === 'logout') {
            await waInstance.logout();
            return NextResponse.json({ success: true, message: "Logging out..." });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
