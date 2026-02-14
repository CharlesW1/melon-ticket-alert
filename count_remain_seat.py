import requests
import time

#######################################################
########### 아래 값 채워준 뒤 실행해주시면 됩니다. #############
#######################################################
prodId = ""
pocCode = ""
scheduleNo = ""
cookie = ""
slack_webhook_url = ""
#######################################################
#######################################################

# Bolt: Hoisted headers for reuse and clarity.
MELON_HEADERS = {
    'Accept': 'text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'Cookie': cookie,
    'Host': 'ticket.melon.com',
    'Referer': 'https://ticket.melon.com/reservation/popup/stepBlock.htm',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def get_seats_summary(session: requests.Session) -> dict:
    url = "https://ticket.melon.com/tktapi/product/summary.json?v=1" 
   
    body = {
        'prodId': prodId,
        'pocCode': pocCode,
        'scheduleNo': scheduleNo
    }

    # Bolt: Reusing session for connection pooling
    response = session.post(url, headers=MELON_HEADERS, data=body)
    return response.json()

def check_remaining_seats(seats: list) -> list:
    result = []
    
    for seat in seats:
        if seat.get('realSeatCntlk', 0) > 0:
            result.append(generate_message(seat))

    return result

def send_message(messages: list) -> None:
    if not slack_webhook_url:
        if messages:
            print(f"Slack URL not set. Messages: {messages}")
        return

    for message in messages:
        try:
            # Bolt: Use a direct post to avoid session header pollution
            requests.post(slack_webhook_url, json={'text' : message}, timeout=5)
        except Exception as e:
            print(f"Failed to send Slack message: {e}")
   
def generate_message(seat: dict) -> str: 
    message_parts = []
    if 'seatGradeName' in seat:
        message_parts.append(seat['seatGradeName'] + ",")
    if 'floorNo' in seat:
        message_parts.append(seat['floorNo'])
    if 'floorName' in seat:
        message_parts.append(seat['floorName'])
    if 'areaNo' in seat:
        message_parts.append(seat['areaNo'])
    if 'areaName' in seat:
        message_parts.append(seat['areaName'])

    message = " ".join(message_parts)
    message += f"에 잔여좌석 {seat['realSeatCntlk']}개 발생! "
    return message

def main() -> None:
    # Bolt: Use requests.Session to maintain connections between iterations
    with requests.Session() as session:
        for i in range(30):
            try:
                seats = get_seats_summary(session)
                if 'summary' in seats:
                    messages = check_remaining_seats(seats['summary'])
                    send_message(messages)
            except Exception as e:
                print(f"Error in iteration {i+1}: {e}")

            if i < 29:
                time.sleep(2)

if __name__ == "__main__":
    main()
